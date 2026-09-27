import { randomBytes } from 'node:crypto';
import type { ApiRequest, ApiResponse } from '../http.ts';
import { errors, HttpError, json } from '../http.ts';
import type { Ctx } from '../context.ts';
import { DUMMY_HASH_PROMISE, hashPassword, verifyPassword } from '../auth/password.ts';
import { clearSessionCookie, createSession, destroySession, hashToken, SESSION_COOKIE, sessionCookie } from '../auth/session.ts';
import { parseCookies } from '../http.ts';
import { isUniqueViolation } from '../db/client.ts';
import { audit } from '../lib/audit.ts';
import { sendEmail } from '../lib/email.ts';
import { memberById, memberByUserId, MEMBER_COLUMNS, MEMBER_FROM, serializeMember, slugify, type MemberRow } from '../lib/members.ts';
import { rateLimit } from '../lib/ratelimit.ts';
import { displayCode, findReferrer, generateCode } from '../lib/referral.ts';
import { refreshScore } from '../lib/score.ts';
import { loginSchema, resetConfirmSchema, resetRequestSchema, signupSchema } from '../lib/validate.ts';
import { parse, publicUser } from './_util.ts';

interface UserRow { id: string; email: string; role: 'member' | 'admin'; status: 'active' | 'disabled' | 'deleted'; password_hash: string }

function privateMember(row: MemberRow, env: Ctx['env']) {
  const origin = env.APP_ORIGIN.replace(/\/$/, '');
  return { ...serializeMember(row), referralCode: displayCode(row.referral_code), referralLink: `${origin}/join?ref=${row.referral_code}`, visibility: row.visibility };
}

async function signIn(ctx: Ctx, userId: string): Promise<void> {
  const { token, expiresAt } = await createSession(ctx.db, ctx.env, userId);
  ctx.cookies.push(sessionCookie(ctx.env, token, expiresAt, ctx.secure));
}

export async function signup(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  await rateLimit(ctx.db, `signup:ip:${ctx.ipHash}`, 10, 3600);
  const input = parse(signupSchema, req.body);
  const referrer = input.code ? await findReferrer(ctx.db, input.code) : null;
  if (input.code && !referrer) throw new HttpError(400, 'invalid_code', 'That invitation code is not valid.', { issues: [{ path: 'code', message: 'That invitation code is not valid.' }] });
  if (!referrer && ctx.env.signupRequiresInvite) throw new HttpError(400, 'code_required', 'Membership is invite only. Enter an invitation code.', { issues: [{ path: 'code', message: 'Enter your invitation code.' }] });
  const passwordHash = await hashPassword(input.password);
  const role = ctx.env.adminEmails.includes(input.email) ? 'admin' : 'member';
  const firstName = input.name.split(/\s+/)[0] ?? input.name;

  const created = await ctx.db.transaction(async (tx) => {
    const dup = await tx.query('select 1 from users where lower(email) = lower($1)', [input.email]);
    if (dup.rowCount) throw errors.conflict('email_taken', 'An account with that email already exists. Sign in instead.');
    const user = (await tx.query<{ id: string }>('insert into users (email, password_hash, role, last_login_at) values ($1, $2, $3, now()) returning id', [input.email, passwordHash, role])).rows[0]!;
    /* unique slug + unique referral code: retry only the collision, inside a savepoint so the transaction survives */
    const base = slugify(input.name);
    let member: { id: string } | null = null;
    for (let attempt = 0; attempt < 40 && !member; attempt++) {
      const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
      await tx.query('savepoint member_insert');
      try {
        member = (await tx.query<{ id: string }>(
          `insert into members (user_id, slug, name, first_name, company, country, referral_code, referred_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
          [user.id, slug, input.name, firstName, input.business ?? '', input.country ?? '', generateCode(), referrer?.id ?? null])).rows[0]!;
        await tx.query('release savepoint member_insert');
      } catch (e) {
        await tx.query('rollback to savepoint member_insert');
        if (!isUniqueViolation(e)) throw e;
      }
    }
    if (!member) throw new Error('could not allocate a unique member slug');
    if (referrer) {
      await tx.query('insert into referrals (referred_member_id, referrer_member_id, code, source) values ($1, $2, $3, $4) on conflict (referred_member_id) do nothing', [member.id, referrer.id, referrer.referral_code, 'signup']);
      await audit(tx, { action: 'referral.attributed', subjectType: 'member', subjectId: member.id, actorUserId: user.id, actorMemberId: member.id, data: { referrer: referrer.id, code: referrer.referral_code }, ipHash: ctx.ipHash });
    }
    await refreshScore(tx, member.id, ctx.now());
    await audit(tx, { action: 'account.created', subjectType: 'user', subjectId: user.id, actorUserId: user.id, actorMemberId: member.id, data: { role, invited: !!referrer }, ipHash: ctx.ipHash });
    return { userId: user.id, memberId: member.id };
  });

  await signIn(ctx, created.userId);
  const member = (await memberById(ctx.db, created.memberId))!;
  return json({
    user: { id: created.userId, email: input.email, role },
    member: privateMember(member, ctx.env),
    referral: referrer ? { referrer: { id: referrer.slug, name: referrer.name } } : null
  }, 201);
}

export async function login(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  await rateLimit(ctx.db, `login:ip:${ctx.ipHash}`, 30, 900);
  const input = parse(loginSchema, req.body);
  await rateLimit(ctx.db, `login:email:${input.email}`, 10, 900);
  const { rows } = await ctx.db.query<UserRow>('select id, email, role, status, password_hash from users where lower(email) = lower($1)', [input.email]);
  const user = rows[0];
  /* the same work happens whether or not the account exists, so timing never says which */
  const ok = await verifyPassword(input.password, user?.password_hash ?? (await DUMMY_HASH_PROMISE));
  if (!user || !ok) throw new HttpError(401, 'invalid_credentials', 'That email and password do not match.');
  if (user.status !== 'active') throw new HttpError(403, 'account_disabled', 'This account is not active. Contact support.');
  const role = ctx.env.adminEmails.includes(user.email.toLowerCase()) ? 'admin' : user.role;
  await ctx.db.query('update users set last_login_at = now(), role = $2, updated_at = now() where id = $1', [user.id, role]);
  await signIn(ctx, user.id);
  await audit(ctx.db, { action: 'auth.login', subjectType: 'user', subjectId: user.id, actorUserId: user.id, ipHash: ctx.ipHash });
  const member = await memberByUserId(ctx.db, user.id);
  return json({ user: { id: user.id, email: user.email, role }, member: member ? privateMember(member, ctx.env) : null });
}

export async function logout(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  const token = parseCookies(req.headers['cookie'])[SESSION_COOKIE];
  await destroySession(ctx.db, token);
  ctx.cookies.push(clearSessionCookie(ctx.secure));
  return json({ ok: true });
}

export async function session(_req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  if (!ctx.session) return json({ user: null, member: null });
  return json({ user: publicUser(ctx.session), member: ctx.member ? privateMember(ctx.member, ctx.env) : null });
}

export async function resetRequest(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  await rateLimit(ctx.db, `reset:ip:${ctx.ipHash}`, 5, 3600);
  const input = parse(resetRequestSchema, req.body);
  await rateLimit(ctx.db, `reset:email:${input.email}`, 3, 3600);
  const { rows } = await ctx.db.query<{ id: string }>('select id from users where lower(email) = lower($1) and status = $2', [input.email, 'active']);
  const user = rows[0];
  const configured = !!ctx.env.RESEND_API_KEY;
  if (user) {
    const token = randomBytes(32).toString('base64url');
    await ctx.db.query('insert into password_resets (user_id, token_hash, expires_at) values ($1, $2, now() + interval \'1 hour\')', [user.id, hashToken(token)]);
    const link = `${ctx.env.APP_ORIGIN.replace(/\/$/, '')}/auth/?reset=${token}`;
    await sendEmail(ctx.env, { to: input.email, subject: 'Reset your Trulinq password', text: `Use this link within the hour to choose a new password:\n\n${link}\n\nIf you did not ask for this, ignore this email.` });
    await audit(ctx.db, { action: 'auth.reset_requested', subjectType: 'user', subjectId: user.id, ipHash: ctx.ipHash });
  }
  /* the response is identical whether or not the address has an account */
  return json({ ok: true, delivered: configured, reason: configured ? undefined : 'email_not_configured' });
}

export async function resetConfirm(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  await rateLimit(ctx.db, `reset-confirm:ip:${ctx.ipHash}`, 10, 3600);
  const input = parse(resetConfirmSchema, req.body);
  const { rows } = await ctx.db.query<{ id: string; user_id: string }>('select id, user_id from password_resets where token_hash = $1 and used_at is null and expires_at > now()', [hashToken(input.token)]);
  const reset = rows[0];
  if (!reset) throw new HttpError(400, 'invalid_token', 'That reset link is not valid any more. Request a new one.');
  const passwordHash = await hashPassword(input.password);
  await ctx.db.transaction(async (tx) => {
    await tx.query('update password_resets set used_at = now() where id = $1', [reset.id]);
    await tx.query('update users set password_hash = $2, updated_at = now() where id = $1', [reset.user_id, passwordHash]);
    await tx.query('delete from sessions where user_id = $1', [reset.user_id]);
    await audit(tx, { action: 'auth.password_reset', subjectType: 'user', subjectId: reset.user_id, actorUserId: reset.user_id, ipHash: ctx.ipHash });
  });
  await signIn(ctx, reset.user_id);
  const { rows: urows } = await ctx.db.query<UserRow>(`select id, email, role, status, password_hash from users where id = $1`, [reset.user_id]);
  const member = await memberByUserId(ctx.db, reset.user_id);
  return json({ user: { id: urows[0]!.id, email: urows[0]!.email, role: urows[0]!.role }, member: member ? privateMember(member, ctx.env) : null });
}

/** used by /me routes as well */
export { privateMember };
/* keep the shared query fragments referenced so the import surface stays honest for tooling */
void MEMBER_COLUMNS; void MEMBER_FROM;
