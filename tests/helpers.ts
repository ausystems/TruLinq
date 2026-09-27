import { loadEnv, type Env } from '../server/env.ts';
import { getDb, type Db } from '../server/db/client.ts';
import { migrate, resetMigrationCache } from '../server/db/migrate.ts';
import { handleRequest } from '../server/index.ts';
import type { ApiResponse } from '../server/http.ts';

export interface CallOptions { body?: unknown; cookie?: string; headers?: Record<string, string>; ip?: string; raw?: Buffer; csrf?: boolean; now?: () => Date }
export interface Harness { db: Db; env: Env; call: (method: string, path: string, o?: CallOptions) => Promise<{ status: number; body: any; headers: Record<string, string | string[]>; cookie?: string }> }

export async function createHarness(overrides: Record<string, string> = {}): Promise<Harness> {
  const env = loadEnv({ NODE_ENV: 'test', ADMIN_EMAILS: 'admin@trulinq.test', APP_ORIGIN: 'https://trulinq.test', ALLOWED_ORIGINS: 'https://trulinq.test', ...overrides });
  const db = await getDb(env, { memory: true });
  resetMigrationCache();
  await migrate(db);
  const call: Harness['call'] = async (method, path, o = {}) => {
    const url = new URL(path, 'http://localhost');
    const res: ApiResponse = await handleRequest({
      method, path: url.pathname, query: url.searchParams,
      headers: { host: 'trulinq.test', 'x-forwarded-proto': 'https', origin: 'https://trulinq.test', ...(o.csrf === false ? {} : { 'x-requested-with': 'fetch' }), ...(o.cookie ? { cookie: o.cookie } : {}), ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(o.headers ?? {}) },
      body: o.body, rawBody: o.raw, ip: o.ip ?? '203.0.113.7'
    }, { env, db, now: o.now });
    const setCookie = res.headers['set-cookie'];
    const first = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    const cookie = first ? first.split(';')[0] : undefined;
    return { status: res.status, body: res.body, headers: res.headers, cookie };
  };
  return { db, env, call };
}

/** Tyler Shirakawa's referral code on the live product, kept by the seed. */
export const TYLER_CODE = 'E9EAF5';

/** pass code: null to sign up without an invitation code */
export async function signup(h: Harness, email: string, name = 'Test User', code: string | null = TYLER_CODE, extra: Record<string, unknown> = {}) {
  const { ip, ...rest } = extra;
  return h.call('POST', '/auth/signup', { body: { name, email, password: 'a long passphrase 42', ...(code ? { code } : {}), agree: true, ...rest }, ip: ip as string | undefined });
}
