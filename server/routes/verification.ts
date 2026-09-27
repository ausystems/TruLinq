import { createHash, randomUUID } from 'node:crypto';
import type { ApiRequest, ApiResponse } from '../http.ts';
import { errors, HttpError, json } from '../http.ts';
import type { Ctx } from '../context.ts';
import { audit } from '../lib/audit.ts';
import { reference } from '../lib/ids.ts';
import { rateLimit } from '../lib/ratelimit.ts';
import { refreshScore } from '../lib/score.ts';
import { putPrivateObject } from '../lib/storage.ts';
import { uuid as uuidSchema, verificationSubmitSchema } from '../lib/validate.ts';
import { parse, requireMember } from './_util.ts';

interface RequestRow { id: string; reference: string; status: string; submitted_at: Date; review_started_at: Date | null; decided_at: Date | null; decision_note: string | null; identity: Record<string, unknown>; business: Record<string, unknown> }
const summarize = (r: RequestRow, documents: number) => ({
  id: r.id, reference: r.reference, status: r.status, submittedAt: r.submitted_at.toISOString(), reviewStartedAt: r.review_started_at?.toISOString() ?? null,
  decidedAt: r.decided_at?.toISOString() ?? null, note: r.decision_note, documents,
  identity: { idType: r.identity['idType'] ?? null, country: r.identity['country'] ?? null },
  business: { name: r.business['name'] ?? null, registration: r.business['registration'] ?? null, registeredIn: r.business['registeredIn'] ?? null, website: r.business['website'] ?? null }
});

export async function myVerification(_req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  const { member } = requireMember(ctx);
  const { rows } = await ctx.db.query<RequestRow & { documents: string }>(
    `select r.*, (select count(*)::text from verification_documents d where d.request_id = r.id) as documents from verification_requests r where r.member_id = $1 order by r.submitted_at desc limit 1`, [member.id]);
  const r = rows[0];
  return json({ status: member.verification_status, request: r ? summarize(r, Number(r.documents)) : null });
}

export async function submitVerification(req: ApiRequest, ctx: Ctx): Promise<ApiResponse> {
  const { session, member } = requireMember(ctx);
  await rateLimit(ctx.db, `verify:user:${session.user_id}`, 5, 86400);
  const input = parse(verificationSubmitSchema, req.body);
  if (member.verification_status === 'verified') throw errors.conflict('already_verified', 'This profile is already verified.');
  const open = await ctx.db.query<RequestRow>(`select * from verification_requests where member_id = $1 and status in ('submitted', 'in_review') limit 1`, [member.id]);
  if (open.rows[0]) throw new HttpError(409, 'request_open', 'You already have an application in review.', { reference: open.rows[0].reference });

  const ref = reference('TQ', ctx.now());
  const request = await ctx.db.transaction(async (tx) => {
    const r = (await tx.query<RequestRow>(
      `insert into verification_requests (member_id, reference, status, identity, business, terms_accepted_at)
       values ($1, $2, 'submitted', $3::jsonb, $4::jsonb, now()) returning *`,
      [member.id, ref, JSON.stringify(input.identity), JSON.stringify(input.business)])).rows[0]!;
    /* the application fills in what the profile does not have yet; existing profile choices are kept */
    await tx.query(
      `update members set verification_status = 'pending',
         company = case when company = '' then $2 else company end,
         industry = case when industry = '' then $3 else industry end,
         website = case when website = '' then $4 else website end,
         role = case when role = '' then $5 else role end,
         updated_at = now()
       where id = $1`, [member.id, input.business.name, input.business.industry, input.business.website ?? '', input.business.role]);
    await refreshScore(tx, member.id, ctx.now());
    await audit(tx, { action: 'verification.submitted', subjectType: 'verification_request', subjectId: r.id, actorUserId: session.user_id, actorMemberId: member.id, data: { reference: ref, idType: input.identity.idType, country: input.identity.country }, ipHash: ctx.ipHash });
    return r;
  });
  return json({ status: 'pending', request: summarize(request, 0) }, 201);
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']);
const MAX_BYTES = 8 * 1024 * 1024;

export async function uploadDocument(req: ApiRequest, ctx: Ctx, params: Record<string, string>): Promise<ApiResponse> {
  const { session, member } = requireMember(ctx);
  await rateLimit(ctx.db, `upload:user:${session.user_id}`, 20, 3600);
  const requestId = parse(uuidSchema, params['id']);
  const own = await ctx.db.query<{ id: string; status: string }>('select id, status from verification_requests where id = $1 and member_id = $2', [requestId, member.id]);
  const r = own.rows[0];
  if (!r) throw errors.notFound('request_not_found', 'No such application.');
  if (!['submitted', 'in_review'].includes(r.status)) throw errors.conflict('request_closed', 'That application is closed.');
  const kind = req.query.get('kind') === 'business' ? 'business' : 'identity';
  const name = (req.query.get('name') || 'document').replace(/[^\w.\- ]+/g, '').slice(0, 120) || 'document';
  const mime = (req.headers['content-type'] || '').split(';')[0]!.trim().toLowerCase();
  if (!ALLOWED_MIME.has(mime)) throw errors.badRequest('unsupported_type', 'Upload a JPG, PNG, WEBP, HEIC or PDF.');
  const bytes = req.rawBody;
  if (!bytes || !bytes.length) throw errors.badRequest('empty_upload', 'The file is empty.');
  if (bytes.length > MAX_BYTES) throw new HttpError(413, 'too_large', 'Files must be 8 MB or smaller.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const key = `verification/${requestId}/${randomUUID()}`;
  const stored = await putPrivateObject(ctx.env, key, bytes, mime);
  const doc = (await ctx.db.query<{ id: string; uploaded_at: Date }>(
    'insert into verification_documents (request_id, kind, storage_key, original_name, mime, bytes, sha256) values ($1, $2, $3, $4, $5, $6, $7) returning id, uploaded_at',
    [requestId, kind, stored.key, name, mime, bytes.length, sha256])).rows[0]!;
  await audit(ctx.db, { action: 'verification.document_uploaded', subjectType: 'verification_request', subjectId: requestId, actorUserId: session.user_id, actorMemberId: member.id, data: { kind, bytes: bytes.length, mime }, ipHash: ctx.ipHash });
  return json({ document: { id: doc.id, kind, name, bytes: bytes.length, uploadedAt: doc.uploaded_at.toISOString() } }, 201);
}
