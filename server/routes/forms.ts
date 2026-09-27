import type { ApiRequest, ApiResponse } from '../http.ts';
import { json } from '../http.ts';
import type { Ctx } from '../context.ts';
import { shortReference } from '../lib/ids.ts';
import { sendEmail } from '../lib/email.ts';
import { rateLimit } from '../lib/ratelimit.ts';
import { contactSchema, newsletterSchema, reportSchema } from '../lib/validate.ts';
import { parse } from './_util.ts';
import { SITE } from '../../src/data/site.js';

/* Where each topic goes: the addresses are written once, in src/data/site.js, and shared with the pages. */
export const CONTACT_TO: Record<string, string> = { support: SITE.email.support, fraud: SITE.email.trust, privacy: SITE.email.privacy, enterprise: SITE.email.sales };

export async function contact(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  await rateLimit(ctx.db, `contact:ip:${ctx.ipHash}`, 10, 3600);
  const input = parse(contactSchema, req.body);
  const ref = shortReference('TQ-CT');
  await ctx.db.query('insert into contact_messages (reference, topic, name, email, message, profile_link, wants_copy, member_id, ip_hash) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
    [ref, input.topic, input.name, input.email, input.message, input.profile || null, input.copy, ctx.member?.id ?? null, ctx.ipHash]);
  const to = CONTACT_TO[input.topic]!;
  const text = `Reference ${ref}\nFrom: ${input.name} <${input.email}>\nTopic: ${input.topic}${input.profile ? `\nProfile: ${input.profile}` : ''}\n\n${input.message}`;
  const sent = await sendEmail(ctx.env, { to, subject: `[${input.topic}] ${ref} from ${input.name}`, text });
  if (input.copy && sent.delivered) await sendEmail(ctx.env, { to: input.email, subject: `Your message to Trulinq (${ref})`, text: `We received your message. Reference ${ref}. A person replies within one business day.\n\n${input.message}` });
  return json({ reference: ref, to, delivered: sent.delivered, reason: sent.reason }, 201);
}

export async function report(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  await rateLimit(ctx.db, `report:ip:${ctx.ipHash}`, 10, 3600);
  const input = parse(reportSchema, req.body);
  const ref = shortReference('TQ-RP');
  await ctx.db.query('insert into reports (reference, profile_link, details, reporter_email, reporter_member_id, ip_hash) values ($1, $2, $3, $4, $5, $6)',
    [ref, input.link, input.details, input.email || null, ctx.member?.id ?? null, ctx.ipHash]);
  const sent = await sendEmail(ctx.env, { to: CONTACT_TO['fraud']!, subject: `Report ${ref}`, text: `Profile: ${input.link}\nReporter: ${input.email || 'not given'}\n\n${input.details}` });
  return json({ reference: ref, delivered: sent.delivered }, 201);
}

export async function newsletter(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  await rateLimit(ctx.db, `newsletter:ip:${ctx.ipHash}`, 10, 3600);
  const input = parse(newsletterSchema, req.body);
  await ctx.db.query('insert into newsletter_subscribers (email) values ($1) on conflict (email) do nothing', [input.email]);
  return json({ ok: true }, 201);
}
