import type { ZodType } from 'zod';
import type { Ctx } from '../context.ts';
import { errors, HttpError } from '../http.ts';
import type { MemberRow } from '../lib/members.ts';
import type { SessionRow } from '../auth/session.ts';

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data ?? {});
  if (r.success) return r.data;
  const issues = r.error.issues.map((i) => ({ path: i.path.map(String).join('.'), message: i.message }));
  throw new HttpError(400, 'validation_error', issues[0]?.message || 'Check the form and try again.', { issues });
}

export function requireUser(ctx: Ctx): SessionRow {
  if (!ctx.session) throw errors.unauthorized();
  return ctx.session;
}
export function requireMember(ctx: Ctx): { session: SessionRow; member: MemberRow } {
  const session = requireUser(ctx);
  if (!ctx.member) throw new HttpError(409, 'no_member_record', 'This account has no member profile yet.');
  return { session, member: ctx.member };
}
export function requireVerified(ctx: Ctx): { session: SessionRow; member: MemberRow } {
  const r = requireMember(ctx);
  if (r.member.verification_status !== 'verified') throw new HttpError(403, 'not_verified', 'Only verified members can do that.');
  return r;
}
export function requireAdmin(ctx: Ctx): SessionRow {
  const session = requireUser(ctx);
  if (session.role !== 'admin') throw errors.forbidden();
  return session;
}

export const publicUser = (s: SessionRow): { id: string; email: string; role: string } => ({ id: s.user_id, email: s.email, role: s.role });
