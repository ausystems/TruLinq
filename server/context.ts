import type { Db } from './db/client.ts';
import type { Env } from './env.ts';
import type { SessionRow } from './auth/session.ts';
import type { MemberRow } from './lib/members.ts';

export interface Ctx {
  db: Db;
  env: Env;
  /** the authenticated user, if the session cookie was valid */
  session: SessionRow | null;
  /** the member record attached to that user (every signed-up user has one) */
  member: MemberRow | null;
  /** whether the request arrived over https (drives the cookie's Secure flag) */
  secure: boolean;
  /** Set-Cookie values collected by the route */
  cookies: string[];
  /** salted hash of the caller's IP, for rate limits and audit rows; never the raw address */
  ipHash: string;
  now: () => Date;
}
