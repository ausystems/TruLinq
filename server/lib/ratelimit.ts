/* Fixed-window counters in Postgres, so limits hold across serverless instances. One atomic upsert per hit. */
import { createHash } from 'node:crypto';
import type { Queryable } from '../db/client.ts';
import { errors } from '../http.ts';

export function hashIp(ip: string, salt: string): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

export async function rateLimit(db: Queryable, key: string, max: number, windowSeconds: number): Promise<void> {
  const { rows } = await db.query<{ count: number; window_start: Date }>(
    `insert into rate_limits (key, window_start, count) values ($1, now(), 1)
     on conflict (key) do update set
       count = case when rate_limits.window_start < now() - ($2::int * interval '1 second') then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start < now() - ($2::int * interval '1 second') then now() else rate_limits.window_start end
     returning count, window_start`, [key, windowSeconds]);
  const row = rows[0];
  if (row && Number(row.count) > max) {
    const retry = Math.max(1, Math.ceil((new Date(row.window_start).getTime() + windowSeconds * 1000 - Date.now()) / 1000));
    throw errors.tooMany(retry);
  }
}

/** Housekeeping for old windows; cheap and safe to call occasionally. */
export async function pruneRateLimits(db: Queryable): Promise<void> {
  await db.query(`delete from rate_limits where window_start < now() - interval '1 day'`);
}
