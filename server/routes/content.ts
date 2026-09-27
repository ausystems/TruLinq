import type { ApiRequest, ApiResponse } from '../http.ts';
import { errors, HttpError, json } from '../http.ts';
import type { Ctx } from '../context.ts';
import { isUniqueViolation } from '../db/client.ts';
import { audit } from '../lib/audit.ts';
import { memberBySlug, monogramDataUri } from '../lib/members.ts';
import { rateLimit } from '../lib/ratelimit.ts';
import { endorsementSchema, feedQuerySchema, messageSchema, postSchema, slug as slugSchema } from '../lib/validate.ts';
import { parse, requireVerified } from './_util.ts';

interface PostRow { id: string; kind: string; body: string; reply_count: number; created_at: Date; slug: string; name: string; company: string; role: string; photo: string | null }
const post = (p: PostRow) => ({ id: p.id, by: p.slug, kind: p.kind, text: p.body, replies: p.reply_count, at: p.created_at.toISOString(), author: { id: p.slug, name: p.name, company: p.company, role: p.role, photo: p.photo || monogramDataUri(p.name) } });
const POST_SELECT = `select p.id, p.kind, p.body, p.reply_count, p.created_at, m.slug, m.name, m.company, m.role, m.photo from posts p join members m on m.id = p.member_id`;

export async function listPosts(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  const q = parse(feedQuerySchema, Object.fromEntries(req.query.entries()));
  const where = [`m.visibility = 'public'`];
  const params: unknown[] = [];
  if (q.kind) { params.push(q.kind); where.push(`p.kind = $${params.length}`); }
  if (q.before) { params.push(q.before); where.push(`p.created_at < $${params.length}`); }
  params.push(q.limit + 1);
  const { rows } = await ctx.db.query<PostRow>(`${POST_SELECT} where ${where.join(' and ')} order by p.created_at desc limit $${params.length}`, params);
  const page = rows.slice(0, q.limit);
  return json({ posts: page.map(post), nextBefore: rows.length > q.limit ? page[page.length - 1]!.created_at.toISOString() : null });
}

export async function createPost(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  const { session, member } = requireVerified(ctx);
  await rateLimit(ctx.db, `post:user:${session.user_id}`, 20, 3600);
  const input = parse(postSchema, req.body);
  const id = (await ctx.db.query<{ id: string }>('insert into posts (member_id, kind, body) values ($1, $2, $3) returning id', [member.id, input.kind, input.body])).rows[0]!.id;
  const { rows } = await ctx.db.query<PostRow>(`${POST_SELECT} where p.id = $1`, [id]);
  return json({ post: post(rows[0]!) }, 201);
}

interface RoomRow { slug: string; name: string; emoji: string; topic: string; live: boolean; members: { id: string; photo: string | null; name: string }[] | string; member_count: string }
export async function listRooms(_req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  const { rows } = await ctx.db.query<RoomRow>(
    `select r.slug, r.name, r.emoji, r.topic, r.live,
            (select count(*)::text from room_members rm where rm.room_slug = r.slug) as member_count,
            (select coalesce(json_agg(json_build_object('id', m.slug, 'photo', m.photo, 'name', m.name) order by rm.joined_at), '[]'::json)
               from (select * from room_members rm2 where rm2.room_slug = r.slug order by rm2.joined_at limit 3) rm join members m on m.id = rm.member_id) as members
       from rooms r order by r.sort, r.name`);
  return json({ rooms: rows.map((r) => { const members = typeof r.members === 'string' ? JSON.parse(r.members) as { id: string; photo: string | null; name: string }[] : r.members; return { slug: r.slug, name: r.name, emoji: r.emoji, topic: r.topic, live: r.live, memberCount: Number(r.member_count), members: members.map((m) => ({ id: m.id, photo: m.photo || monogramDataUri(m.name) })) }; }) });
}

interface MessageRow { id: string; body: string; created_at: Date; slug: string; name: string; photo: string | null }
const message = (m: MessageRow) => ({ id: m.id, by: m.slug, text: m.body, at: m.created_at.toISOString(), author: { id: m.slug, name: m.name, photo: m.photo || monogramDataUri(m.name) } });
const MSG_SELECT = `select x.id, x.body, x.created_at, m.slug, m.name, m.photo from room_messages x join members m on m.id = x.member_id`;

export async function roomMessages(req: ApiRequest, ctx: Ctx, params: Record<string, string>): Promise<ApiResponse> {
  const slug = parse(slugSchema, params['slug']);
  const room = await ctx.db.query<{ slug: string }>('select slug from rooms where slug = $1', [slug]);
  if (!room.rows[0]) throw errors.notFound('room_not_found', 'No such room.');
  const limit = Math.min(200, Math.max(1, Number(req.query.get('limit') || 100)));
  const { rows } = await ctx.db.query<MessageRow>(`${MSG_SELECT} where x.room_slug = $1 order by x.created_at desc limit $2`, [slug, limit]);
  return json({ messages: rows.reverse().map(message) });
}

export async function postMessage(req: ApiRequest, ctx: Ctx, params: Record<string, string>): Promise<ApiResponse> {
  const { session, member } = requireVerified(ctx);
  const slug = parse(slugSchema, params['slug']);
  await rateLimit(ctx.db, `msg:user:${session.user_id}`, 60, 3600);
  const input = parse(messageSchema, req.body);
  const room = await ctx.db.query<{ slug: string }>('select slug from rooms where slug = $1', [slug]);
  if (!room.rows[0]) throw errors.notFound('room_not_found', 'No such room.');
  const id = await ctx.db.transaction(async (tx) => {
    await tx.query('insert into room_members (room_slug, member_id) values ($1, $2) on conflict do nothing', [slug, member.id]);
    return (await tx.query<{ id: string }>('insert into room_messages (room_slug, member_id, body) values ($1, $2, $3) returning id', [slug, member.id, input.body])).rows[0]!.id;
  });
  const { rows } = await ctx.db.query<MessageRow>(`${MSG_SELECT} where x.id = $1`, [id]);
  return json({ message: message(rows[0]!) }, 201);
}

export async function createEndorsement(req: ApiRequest, ctx: Ctx, params: Record<string, string>): Promise<ApiResponse> {
  const { session, member } = requireVerified(ctx);
  const slug = parse(slugSchema, params['slug']);
  await rateLimit(ctx.db, `endorse:user:${session.user_id}`, 20, 86400);
  const input = parse(endorsementSchema, req.body);
  const target = await memberBySlug(ctx.db, slug);
  if (!target || target.visibility !== 'public') throw errors.notFound('member_not_found', 'No member with that address.');
  if (target.id === member.id) throw new HttpError(400, 'self_endorsement', 'You cannot endorse yourself.');
  try {
    const row = (await ctx.db.query<{ id: string; created_at: Date }>('insert into endorsements (to_member_id, from_member_id, body) values ($1, $2, $3) returning id, created_at', [target.id, member.id, input.body])).rows[0]!;
    await audit(ctx.db, { action: 'endorsement.created', subjectType: 'member', subjectId: target.id, actorUserId: session.user_id, actorMemberId: member.id, data: { endorsement: row.id }, ipHash: ctx.ipHash });
    return json({ endorsement: { id: row.id, text: input.body, date: row.created_at.toISOString().slice(0, 10), from: { id: member.slug, name: member.name, role: member.role, company: member.company, photo: member.photo || monogramDataUri(member.name) } } }, 201);
  } catch (e) {
    if (isUniqueViolation(e)) throw errors.conflict('already_endorsed', 'You have already endorsed this member. One per person, always public.');
    throw e;
  }
}
