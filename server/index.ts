/* The API: one router shared by the Vercel function and the local dev server.
   Order of work per request: CORS → schema check → session → CSRF → route → consistent JSON errors. */
import { ZodError } from 'zod';
import type { ApiRequest, ApiResponse } from './http.ts';
import { HttpError, json, matchPath, parseCookies } from './http.ts';
import type { Env } from './env.ts';
import type { Db } from './db/client.ts';
import { isUniqueViolation } from './db/client.ts';
import { ensureMigrated } from './db/migrate.ts';
import { readSession, SESSION_COOKIE } from './auth/session.ts';
import { memberByUserId } from './lib/members.ts';
import { hashIp } from './lib/ratelimit.ts';
import type { Ctx } from './context.ts';
import * as auth from './routes/auth.ts';
import * as members from './routes/members.ts';
import * as verification from './routes/verification.ts';
import * as content from './routes/content.ts';
import * as forms from './routes/forms.ts';
import * as admin from './routes/admin.ts';
import * as stats from './routes/stats.ts';

type Handler = (req: ApiRequest, ctx: Ctx, params: Record<string, string>) => Promise<ApiResponse>;
interface Route { method: string; pattern: string; handler: Handler }

export const ROUTES: Route[] = [
  { method: 'GET', pattern: '/health', handler: stats.health },
  { method: 'GET', pattern: '/stats', handler: stats.stats },
  { method: 'POST', pattern: '/auth/signup', handler: auth.signup },
  { method: 'POST', pattern: '/auth/login', handler: auth.login },
  { method: 'POST', pattern: '/auth/logout', handler: auth.logout },
  { method: 'GET', pattern: '/auth/session', handler: auth.session },
  { method: 'POST', pattern: '/auth/password-reset/request', handler: auth.resetRequest },
  { method: 'POST', pattern: '/auth/password-reset/confirm', handler: auth.resetConfirm },
  { method: 'GET', pattern: '/members', handler: members.listMembers },
  { method: 'GET', pattern: '/members/:slug', handler: members.getMember },
  { method: 'POST', pattern: '/members/:slug/endorsements', handler: content.createEndorsement },
  { method: 'GET', pattern: '/me', handler: members.getMe },
  { method: 'PATCH', pattern: '/me', handler: members.patchMe },
  { method: 'GET', pattern: '/me/referrals', handler: members.myReferrals },
  { method: 'GET', pattern: '/me/verification', handler: verification.myVerification },
  { method: 'POST', pattern: '/me/verification', handler: verification.submitVerification },
  { method: 'PUT', pattern: '/me/verification/:id/documents', handler: verification.uploadDocument },
  { method: 'GET', pattern: '/referrals/:code', handler: members.checkReferral },
  { method: 'GET', pattern: '/posts', handler: content.listPosts },
  { method: 'POST', pattern: '/posts', handler: content.createPost },
  { method: 'GET', pattern: '/rooms', handler: content.listRooms },
  { method: 'GET', pattern: '/rooms/:slug/messages', handler: content.roomMessages },
  { method: 'POST', pattern: '/rooms/:slug/messages', handler: content.postMessage },
  { method: 'POST', pattern: '/contact', handler: forms.contact },
  { method: 'POST', pattern: '/reports', handler: forms.report },
  { method: 'POST', pattern: '/newsletter', handler: forms.newsletter },
  { method: 'GET', pattern: '/admin/verification', handler: admin.verificationQueue },
  { method: 'POST', pattern: '/admin/verification/:id/decision', handler: admin.decide },
  { method: 'POST', pattern: '/admin/members/:slug/status', handler: admin.setMemberStatus },
  { method: 'POST', pattern: '/admin/scores/recompute', handler: admin.recomputeScores },
  { method: 'GET', pattern: '/admin/audit', handler: admin.auditLog }
];

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

function selfOrigin(req: ApiRequest): string | null {
  const host = req.headers['x-forwarded-host'] || req.headers['host'];
  if (!host) return null;
  const proto = req.headers['x-forwarded-proto'] || (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto.split(',')[0]!.trim()}://${host.split(',')[0]!.trim()}`;
}
function originAllowed(origin: string, req: ApiRequest, env: Env): boolean {
  return origin === selfOrigin(req) || env.allowedOrigins.includes(origin) || (!env.isProd && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
}
function corsHeaders(req: ApiRequest, env: Env): Record<string, string> {
  const origin = req.headers['origin'];
  if (!origin || !originAllowed(origin, req, env)) return {};
  return { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true', vary: 'Origin',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type,x-requested-with', 'access-control-max-age': '600' };
}

function errorResponse(e: unknown, path: string): ApiResponse {
  if (e instanceof HttpError) return json({ error: { code: e.code, message: e.message, ...(e.details ? { details: e.details } : {}) } }, e.status, e.status === 429 && e.details && typeof e.details === 'object' && 'retryAfter' in e.details ? { 'retry-after': String((e.details as { retryAfter: number }).retryAfter) } : {});
  if (e instanceof ZodError) return json({ error: { code: 'validation_error', message: e.issues[0]?.message || 'Invalid input.', details: { issues: e.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message })) } } }, 400);
  if (isUniqueViolation(e)) return json({ error: { code: 'conflict', message: 'That already exists.' } }, 409);
  /* never leak internals; log the stack server-side only */
  console.error('[api] unhandled error on', path, e instanceof Error ? e.stack : e);
  return json({ error: { code: 'internal_error', message: 'Something went wrong on our side. Try again in a moment.' } }, 500);
}

export interface Deps { env: Env; db: Db; now?: () => Date }

export async function handleRequest(req: ApiRequest, deps: Deps): Promise<ApiResponse> {
  const { env, db } = deps;
  const cors = corsHeaders(req, env);
  const finish = (res: ApiResponse, cookies: string[] = []): ApiResponse => ({
    ...res,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...cors, ...res.headers, ...(cookies.length ? { 'set-cookie': cookies } : {}) }
  });
  if (req.method === 'OPTIONS') return finish({ status: 204, headers: {}, body: null });

  try { await ensureMigrated(db); }
  catch (e) { console.error('[db] not ready', e instanceof Error ? e.message : e); return finish(json({ error: { code: 'database_unavailable', message: 'The database is not available right now.' } }, 503)); }

  const cookies = parseCookies(req.headers['cookie']);
  const secure = (req.headers['x-forwarded-proto'] || '').startsWith('https') || env.isProd;
  const ctx: Ctx = { db, env, session: null, member: null, secure, cookies: [], ipHash: hashIp(req.ip, env.RATE_LIMIT_SALT), now: deps.now ?? (() => new Date()) };
  try {
    ctx.session = await readSession(db, env, cookies[SESSION_COOKIE]);
    if (ctx.session) ctx.member = await memberByUserId(db, ctx.session.user_id);

    if (!SAFE.has(req.method)) {
      /* CSRF: state changes need the custom header (a cross-site form cannot set it) and, when a browser sends an
         Origin, it has to be ours or on the allow-list */
      if (!req.headers['x-requested-with']) throw new HttpError(403, 'csrf', 'Missing X-Requested-With header.');
      const origin = req.headers['origin'];
      if (origin && !originAllowed(origin, req, env)) throw new HttpError(403, 'csrf', 'Origin not allowed.');
    }

    for (const r of ROUTES) {
      if (r.method !== req.method) continue;
      const params = matchPath(r.pattern, req.path);
      if (!params) continue;
      const res = await r.handler(req, ctx, params);
      return finish(res, ctx.cookies);
    }
    const known = ROUTES.some((r) => matchPath(r.pattern, req.path));
    throw new HttpError(known ? 405 : 404, known ? 'method_not_allowed' : 'not_found', known ? 'Method not allowed.' : 'No such endpoint.');
  } catch (e) {
    return finish(errorResponse(e, req.path), ctx.cookies);
  }
}
