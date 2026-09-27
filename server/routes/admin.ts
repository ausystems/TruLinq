import type { ApiRequest, ApiResponse } from '../http.ts';
import { errors, HttpError, json } from '../http.ts';
import type { Ctx } from '../context.ts';
import { audit } from '../lib/audit.ts';
import { memberById, memberBySlug, serializeMember } from '../lib/members.ts';
import { refreshScore } from '../lib/score.ts';
import { decisionSchema, memberStatusSchema, slug as slugSchema, uuid as uuidSchema } from '../lib/validate.ts';
import { parse, requireAdmin } from './_util.ts';

interface QueueRow { id: string; reference: string; status: string; submitted_at: Date; member_slug: string; member_name: string; company: string; identity: Record<string, unknown>; business: Record<string, unknown>; documents: string }

export async function verificationQueue(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  requireAdmin(ctx);
  const status = ['submitted', 'in_review', 'approved', 'rejected', 'withdrawn'].includes(req.query.get('status') || '') ? req.query.get('status')! : 'submitted';
  const limit = Math.min(100, Math.max(1, Number(req.query.get('limit') || 50)));
  const { rows } = await ctx.db.query<QueueRow>(
    `select r.id, r.reference, r.status, r.submitted_at, m.slug as member_slug, m.name as member_name, m.company, r.identity, r.business,
            (select count(*)::text from verification_documents d where d.request_id = r.id) as documents
       from verification_requests r join members m on m.id = r.member_id where r.status = $1 order by r.submitted_at asc limit $2`, [status, limit]);
  return json({ requests: rows.map((r) => ({ id: r.id, reference: r.reference, status: r.status, submittedAt: r.submitted_at.toISOString(), member: { id: r.member_slug, name: r.member_name, company: r.company }, identity: r.identity, business: r.business, documents: Number(r.documents) })) });
}

export async function decide(req: ApiRequest, ctx: Ctx, params: Record<string, string>): Promise<ApiResponse> {
  const admin = requireAdmin(ctx);
  const id = parse(uuidSchema, params['id']);
  const input = parse(decisionSchema, req.body);
  const result = await ctx.db.transaction(async (tx) => {
    const r = (await tx.query<{ id: string; member_id: string; status: string; business: Record<string, unknown> }>('select id, member_id, status, business from verification_requests where id = $1 for update', [id])).rows[0];
    if (!r) throw errors.notFound('request_not_found', 'No such application.');
    if (!['submitted', 'in_review'].includes(r.status)) throw new HttpError(409, 'request_closed', 'That application has already been decided.');
    if (input.decision === 'in_review') {
      await tx.query(`update verification_requests set status = 'in_review', review_started_at = coalesce(review_started_at, now()), decision_note = coalesce($2, decision_note), updated_at = now() where id = $1`, [id, input.note ?? null]);
    } else if (input.decision === 'approve') {
      await tx.query(`update verification_requests set status = 'approved', review_started_at = coalesce(review_started_at, now()), decided_at = now(), decided_by = $2, decision_note = $3, updated_at = now() where id = $1`, [id, admin.user_id, input.note ?? null]);
      await tx.query(`update members set verification_status = 'verified', verified_on = coalesce(verified_on, current_date), website_verified = $2, updated_at = now() where id = $1`, [r.member_id, input.websiteVerified ?? false]);
    } else {
      await tx.query(`update verification_requests set status = 'rejected', review_started_at = coalesce(review_started_at, now()), decided_at = now(), decided_by = $2, decision_note = $3, updated_at = now() where id = $1`, [id, admin.user_id, input.note ?? null]);
      await tx.query(`update members set verification_status = 'unverified', updated_at = now() where id = $1`, [r.member_id]);
    }
    await refreshScore(tx, r.member_id, ctx.now());
    await audit(tx, { action: `verification.${input.decision}`, subjectType: 'verification_request', subjectId: id, actorUserId: admin.user_id, data: { member: r.member_id, note: input.note ?? null }, ipHash: ctx.ipHash });
    return r.member_id;
  });
  const member = (await memberById(ctx.db, result))!;
  return json({ member: serializeMember(member) });
}

export async function setMemberStatus(req: ApiRequest, ctx: Ctx, params: Record<string, string>): Promise<ApiResponse> {
  const admin = requireAdmin(ctx);
  const slug = parse(slugSchema, params['slug']);
  const input = parse(memberStatusSchema, req.body);
  const m = await memberBySlug(ctx.db, slug);
  if (!m) throw errors.notFound('member_not_found', 'No member with that address.');
  await ctx.db.transaction(async (tx) => {
    await tx.query(`update members set verification_status = $2, verified_on = case when $2 = 'verified' then coalesce(verified_on, current_date) else verified_on end, updated_at = now() where id = $1`, [m.id, input.status]);
    await refreshScore(tx, m.id, ctx.now());
    await audit(tx, { action: 'member.status_changed', subjectType: 'member', subjectId: m.id, actorUserId: admin.user_id, data: { from: m.verification_status, to: input.status, note: input.note ?? null }, ipHash: ctx.ipHash });
  });
  return json({ member: serializeMember((await memberById(ctx.db, m.id))!) });
}

export async function recomputeScores(_req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  requireAdmin(ctx);
  const { rows } = await ctx.db.query<{ id: string }>(`select m.id from members m left join member_scores s on s.member_id = m.id where s.member_id is null or s.source = 'engine'`);
  for (const r of rows) await refreshScore(ctx.db, r.id, ctx.now());
  return json({ recomputed: rows.length });
}

export async function auditLog(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  requireAdmin(ctx);
  const limit = Math.min(200, Math.max(1, Number(req.query.get('limit') || 50)));
  const params: unknown[] = [];
  const where: string[] = [];
  const subjectType = req.query.get('subjectType'), subjectId = req.query.get('subjectId');
  if (subjectType) { params.push(subjectType); where.push(`subject_type = $${params.length}`); }
  if (subjectId) { params.push(subjectId); where.push(`subject_id = $${params.length}`); }
  params.push(limit);
  const { rows } = await ctx.db.query(`select id, at, actor_user_id, actor_member_id, action, subject_type, subject_id, data from audit_events ${where.length ? 'where ' + where.join(' and ') : ''} order by at desc limit $${params.length}`, params);
  return json({ events: rows });
}
