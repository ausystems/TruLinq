import type { ApiRequest, ApiResponse } from '../http.ts';
import { json } from '../http.ts';
import type { Ctx } from '../context.ts';
import { migrationStatus } from '../db/migrate.ts';

export async function stats(_req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  const { rows } = await ctx.db.query<{ people: string; verified: string; revoked: string; posts: string; cities: string; industries: string }>(
    `select (select count(*)::text from members where visibility = 'public') as people,
            (select count(*)::text from members where verification_status = 'revoked') as revoked,
            (select count(*)::text from members where visibility = 'public' and verification_status = 'verified') as verified,
            (select count(*)::text from posts) as posts,
            (select count(distinct city)::text from members where visibility = 'public' and verification_status = 'verified' and city <> '') as cities,
            (select count(distinct industry)::text from members where visibility = 'public' and verification_status = 'verified' and industry <> '') as industries`);
  const r = rows[0]!;
  return json({ people: Number(r.people), verified: Number(r.verified), revoked: Number(r.revoked), posts: Number(r.posts), cities: Number(r.cities), industries: Number(r.industries) }, 200, { 'cache-control': 'public, max-age=60' });
}

export async function health(_req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  const m = await migrationStatus(ctx.db);
  return json({ ok: m.pending.length === 0, database: ctx.db.kind, migrations: { applied: m.applied.length, pending: m.pending } });
}
