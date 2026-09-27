/* Opaque session tokens: 256 random bits in an httpOnly cookie, only their SHA-256 stored. Sessions slide while in
   use and expire after SESSION_TTL_DAYS of inactivity. */
import { createHash, randomBytes } from 'node:crypto';
import type { Queryable } from '../db/client.ts';
import type { Env } from '../env.ts';
import { serializeCookie } from '../http.ts';

export const SESSION_COOKIE = 'tq_session';

export interface SessionUser { id: string; email: string; role: 'member' | 'admin'; status: 'active' | 'disabled' | 'deleted' }
export interface SessionRow { session_id: string; expires_at: Date; last_seen_at: Date; user_id: string; email: string; role: 'member' | 'admin'; status: SessionUser['status'] }

export const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export async function createSession(db: Queryable, env: Env, userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 864e5);
  await db.query('insert into sessions (user_id, token_hash, expires_at) values ($1, $2, $3)', [userId, hashToken(token), expiresAt]);
  return { token, expiresAt };
}

export async function readSession(db: Queryable, env: Env, token: string | undefined): Promise<SessionRow | null> {
  if (!token || token.length < 32 || token.length > 128) return null;
  const { rows } = await db.query<SessionRow>(
    `select s.id as session_id, s.expires_at, s.last_seen_at, u.id as user_id, u.email, u.role, u.status
       from sessions s join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`, [hashToken(token)]);
  const row = rows[0];
  if (!row || row.status !== 'active') return null;
  /* slide the expiry at most once a day, so the hot path is a single read */
  if (Date.now() - new Date(row.last_seen_at).getTime() > 864e5) {
    await db.query('update sessions set last_seen_at = now(), expires_at = $2 where id = $1', [row.session_id, new Date(Date.now() + env.SESSION_TTL_DAYS * 864e5)]);
  }
  return row;
}

export async function destroySession(db: Queryable, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.query('delete from sessions where token_hash = $1', [hashToken(token)]);
}

export function sessionCookie(env: Env, token: string, expiresAt: Date, secure: boolean): string {
  return serializeCookie(SESSION_COOKIE, token, { expires: expiresAt, maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000), secure, sameSite: 'Lax', httpOnly: true });
}
export function clearSessionCookie(secure: boolean): string {
  return serializeCookie(SESSION_COOKIE, '', { maxAge: 0, expires: new Date(0), secure, sameSite: 'Lax', httpOnly: true });
}
