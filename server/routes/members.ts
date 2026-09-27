import type { ApiRequest, ApiResponse } from '../http.ts';
import { errors, HttpError, json } from '../http.ts';
import type { Ctx } from '../context.ts';
import { audit } from '../lib/audit.ts';
import { completeness, memberById, memberBySlug, MEMBER_COLUMNS, MEMBER_FROM, serializeMember, type MemberRow } from '../lib/members.ts';
import { rateLimit } from '../lib/ratelimit.ts';
import { displayCode, findReferrer } from '../lib/referral.ts';
import { refreshScore } from '../lib/score.ts';
import { memberListSchema, profilePatchSchema, slug as slugSchema } from '../lib/validate.ts';
import { parse, publicUser, requireMember } from './_util.ts';
import { privateMember } from './auth.ts';

const PUBLIC_WHERE = `m.visibility = 'public' and m.verification_status = 'verified'`;

export async function listMembers(req: ApiRequest, _ctx: Ctx): Promise<ApiResponse> {
  const q = parse(memberListSchema, Object.fromEntries(req.query.entries()));
  /* "Verified only" off: public members still in review are listed too. Revoked stamps are never listed. */
  const where: string[] = [q.status === 'all' ? `m.visibility = 'public' and m.verification_status in ('verified', 'pending', 'unverified')` : PUBLIC_WHERE];
  const params: unknown[] = [];
  if (q.industry && q.industry !== 'All') { params.push(q.industry); where.push(`m.industry = $${params.length}`); }
  if (q.q) {
    for (const word of q.q.toLowerCase().split(/\s+/).filter(Boolean).slice(0, 6)) {
      params.push(`%${word.replace(/[%_\\]/g, '\\$&')}%`);
      where.push(`lower(concat_ws(' ', m.name, m.headline, m.company, m.city, m.region, m.country, m.industry, m.role, m.offers, m.looking)) like $${params.length} escape '\\'`);
    }
  }
  const order = q.sort === 'score' ? 'coalesce(s.total, 300) desc, m.name asc' : q.sort === 'az' ? 'm.name asc' : 'm.verified_on desc nulls last, m.created_at desc';
  const whereSql = where.join(' and ');
  const total = Number((await _ctx.db.query<{ n: string }>(`select count(*)::text as n from members m where ${whereSql}`, params)).rows[0]!.n);
  params.push(q.limit, (q.page - 1) * q.limit);
  const { rows } = await _ctx.db.query<MemberRow>(`select ${MEMBER_COLUMNS} ${MEMBER_FROM} where ${whereSql} order by ${order} limit $${params.length - 1} offset $${params.length}`, params);
  return json({ members: rows.map(serializeMember), page: q.page, limit: q.limit, total });
}

interface EndorsementRow { id: string; body: string; created_at: Date; from_slug: string; from_name: string; from_role: string; from_company: string; from_photo: string | null }
interface PostRow { id: string; kind: string; body: string; reply_count: number; created_at: Date }

export async function getMember(req: ApiRequest, ctx: Ctx, params: Record<string, string>): Promise<ApiResponse> {
  const slug = parse(slugSchema, params['slug']);
  const row = await memberBySlug(ctx.db, slug);
  const self = !!row && !!ctx.member && ctx.member.id === row.id;
  if (!row || (row.visibility !== 'public' && !self && ctx.session?.role !== 'admin')) throw errors.notFound('member_not_found', 'No member with that address.');
  const [endorsements, posts, neighbours] = await Promise.all([
    ctx.db.query<EndorsementRow>(`select e.id, e.body, e.created_at, f.slug as from_slug, f.name as from_name, f.role as from_role, f.company as from_company, f.photo as from_photo
        from endorsements e join members f on f.id = e.from_member_id where e.to_member_id = $1 order by e.created_at desc limit 50`, [row.id]),
    ctx.db.query<PostRow>('select id, kind, body, reply_count, created_at from posts where member_id = $1 order by created_at desc limit 20', [row.id]),
    ctx.db.query<{ slug: string; pos: string }>(
      `with ordered as (select slug, row_number() over (order by joined_on, slug) as rn from members m where ${PUBLIC_WHERE}),
       me as (select rn from ordered where slug = $1)
       select o.slug, case when o.rn = (select rn from me) - 1 then 'prev' when o.rn = (select rn from me) + 1 then 'next' end as pos
         from ordered o, me where o.rn in ((select rn from me) - 1, (select rn from me) + 1)`, [slug])
  ]);
  const { serializeMember: ser } = await import('../lib/members.ts');
  const first = (await ctx.db.query<{ slug: string }>(`select slug from members m where ${PUBLIC_WHERE} order by joined_on, slug limit 1`)).rows[0]?.slug ?? slug;
  const last = (await ctx.db.query<{ slug: string }>(`select slug from members m where ${PUBLIC_WHERE} order by joined_on desc, slug desc limit 1`)).rows[0]?.slug ?? slug;
  const prev = neighbours.rows.find((n) => n.pos === 'prev')?.slug ?? last;
  const next = neighbours.rows.find((n) => n.pos === 'next')?.slug ?? first;
  return json({
    member: ser(row),
    endorsements: endorsements.rows.map((e) => ({ id: e.id, text: e.body, date: e.created_at.toISOString().slice(0, 10), from: { id: e.from_slug, name: e.from_name, role: e.from_role, company: e.from_company, photo: e.from_photo || null } })),
    posts: posts.rows.map((p) => ({ id: p.id, by: row.slug, kind: p.kind, text: p.body, replies: p.reply_count, at: p.created_at.toISOString() })),
    prev, next
  });
}

export async function getMe(_req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  const { session, member } = requireMember(ctx);
  await refreshScore(ctx.db, member.id, ctx.now());
  const fresh = (await memberById(ctx.db, member.id))!;
  const [verification, subscription, referrals, referrer, endorsements, posts] = await Promise.all([
    ctx.db.query<{ id: string; reference: string; status: string; submitted_at: Date; review_started_at: Date | null; decided_at: Date | null; decision_note: string | null; identity: Record<string, unknown>; business: Record<string, unknown>; documents: string }>(
      `select r.id, r.reference, r.status, r.submitted_at, r.review_started_at, r.decided_at, r.decision_note, r.identity, r.business,
              (select count(*)::text from verification_documents d where d.request_id = r.id) as documents
         from verification_requests r where r.member_id = $1 order by r.submitted_at desc limit 1`, [member.id]),
    ctx.db.query<{ plan: string; status: string; period: string; card_last4: string | null; current_period_end: Date | null }>('select plan, status, period, card_last4, current_period_end from subscriptions where member_id = $1', [member.id]),
    ctx.db.query<{ n: string }>('select count(*)::text as n from referrals where referrer_member_id = $1', [member.id]),
    fresh.referred_by ? ctx.db.query<{ slug: string; name: string }>('select slug, name from members where id = $1', [fresh.referred_by]) : Promise.resolve({ rows: [] as { slug: string; name: string }[], rowCount: 0 }),
    ctx.db.query<EndorsementRow>(`select e.id, e.body, e.created_at, f.slug as from_slug, f.name as from_name, f.role as from_role, f.company as from_company, f.photo as from_photo
        from endorsements e join members f on f.id = e.from_member_id where e.to_member_id = $1 order by e.created_at desc limit 50`, [member.id]),
    ctx.db.query<PostRow>('select id, kind, body, reply_count, created_at from posts where member_id = $1 order by created_at desc limit 20', [member.id])
  ]);
  const v = verification.rows[0];
  return json({
    user: publicUser(session),
    member: { ...privateMember(fresh, ctx.env), email: session.email, completeness: completeness(fresh), createdAt: fresh.created_at.toISOString() },
    verification: v ? { id: v.id, reference: v.reference, status: v.status, submittedAt: v.submitted_at.toISOString(), reviewStartedAt: v.review_started_at?.toISOString() ?? null, decidedAt: v.decided_at?.toISOString() ?? null, note: v.decision_note, identity: { idType: v.identity['idType'] ?? null, country: v.identity['country'] ?? null }, business: { name: v.business['name'] ?? null, registration: v.business['registration'] ?? null, registeredIn: v.business['registeredIn'] ?? null, website: v.business['website'] ?? null }, documents: Number(v.documents) } : null,
    subscription: subscription.rows[0] ? { ...subscription.rows[0], current_period_end: subscription.rows[0].current_period_end ? String(subscription.rows[0].current_period_end).slice(0, 10) : null } : null,
    referrals: { count: Number(referrals.rows[0]?.n ?? 0), referredBy: referrer.rows[0] ? { id: referrer.rows[0].slug, name: referrer.rows[0].name } : null },
    endorsements: endorsements.rows.map((e) => ({ id: e.id, text: e.body, date: e.created_at.toISOString().slice(0, 10), from: { id: e.from_slug, name: e.from_name, role: e.from_role, company: e.from_company, photo: e.from_photo || null } })),
    posts: posts.rows.map((p) => ({ id: p.id, by: fresh.slug, kind: p.kind, text: p.body, replies: p.reply_count, at: p.created_at.toISOString() }))
  });
}

const PATCHABLE = ['name', 'headline', 'role', 'company', 'city', 'region', 'country', 'industry', 'bio', 'offers', 'looking', 'website', 'founded', 'visibility'] as const;

export async function patchMe(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  const { session, member } = requireMember(ctx);
  await rateLimit(ctx.db, `profile:user:${session.user_id}`, 60, 3600);
  const input = parse(profilePatchSchema, req.body);
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const key of PATCHABLE) {
    if (input[key] === undefined) continue;
    params.push(input[key]);
    sets.push(`${key} = $${params.length}`);
    if (key === 'name') { params.push(String(input.name).split(/\s+/)[0]); sets.push(`first_name = $${params.length}`); }
  }
  if (!sets.length) throw errors.badRequest('nothing_to_update', 'Send at least one field to update.');
  params.push(member.id);
  await ctx.db.transaction(async (tx) => {
    await tx.query(`update members set ${sets.join(', ')}, updated_at = now() where id = $${params.length}`, params);
    await refreshScore(tx, member.id, ctx.now());
    await audit(tx, { action: 'profile.updated', subjectType: 'member', subjectId: member.id, actorUserId: session.user_id, actorMemberId: member.id, data: { fields: Object.keys(input) }, ipHash: ctx.ipHash });
  });
  const fresh = (await memberById(ctx.db, member.id))!;
  return json({ member: { ...privateMember(fresh, ctx.env), email: session.email, completeness: completeness(fresh) } });
}

export async function myReferrals(_req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  const { member } = requireMember(ctx);
  const { rows } = await ctx.db.query<{ slug: string; name: string; verification_status: string; joined_on: Date | string; created_at: Date }>(
    `select m.slug, m.name, m.verification_status, m.joined_on, r.created_at from referrals r join members m on m.id = r.referred_member_id where r.referrer_member_id = $1 order by r.created_at desc limit 200`, [member.id]);
  const origin = ctx.env.APP_ORIGIN.replace(/\/$/, '');
  return json({ code: displayCode(member.referral_code), raw: member.referral_code, link: `${origin}/join?ref=${member.referral_code}`, count: rows.length,
    referred: rows.map((r) => ({ id: r.slug, name: r.name, status: r.verification_status, joined: String(r.joined_on).slice(0, 10), at: r.created_at.toISOString() })) });
}

export async function checkReferral(_req: ApiRequest, ctx: Ctx, params: Record<string, string>): Promise<ApiResponse> {
  await rateLimit(ctx.db, `refcheck:ip:${ctx.ipHash}`, 60, 600);
  const code = params['code'] ?? '';
  if (code.length < 6 || code.length > 24) throw new HttpError(400, 'invalid_code', 'That code is not valid.');
  const r = await findReferrer(ctx.db, code);
  if (!r) throw errors.notFound('invalid_code', 'That invitation code is not valid.');
  return json({ valid: true, code: displayCode(r.referral_code), referrer: { id: r.slug, name: r.name } });
}
