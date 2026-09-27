/* Referral (invitation) codes: 8 characters from an alphabet without look-alikes, never starting with "TL" (the
   site's input formatter treats a leading TL as the display prefix). Imported codes of 6 to 12 characters, such as
   E9EAF5, are accepted as they are. */
import { randomInt } from 'node:crypto';
import type { Queryable } from '../db/client.ts';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_RE = /^[A-Z0-9]{6,12}$/;

export function generateCode(): string {
  for (;;) {
    let code = '';
    for (let i = 0; i < 8; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    if (!code.startsWith('TL')) return code;
  }
}

/** Every canonical form a typed code could mean, most literal first. */
export function codeCandidates(input: string): string[] {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const out: string[] = [];
  if (CODE_RE.test(raw)) out.push(raw);
  if (raw.startsWith('TL')) { const rest = raw.slice(2); if (CODE_RE.test(rest) && !out.includes(rest)) out.push(rest); }
  return out;
}

/** Display form for the site's inputs: TL-XXXX-XXXX for 8-character codes, otherwise the code itself. */
export function displayCode(code: string): string {
  return code.length === 8 ? `TL-${code.slice(0, 4)}-${code.slice(4)}` : code;
}

export interface ReferrerRow { id: string; slug: string; name: string; referral_code: string; visibility: string; verification_status: string }
export async function findReferrer(db: Queryable, input: string): Promise<ReferrerRow | null> {
  const candidates = codeCandidates(input);
  if (!candidates.length) return null;
  const { rows } = await db.query<ReferrerRow>(
    `select id, slug, name, referral_code, visibility, verification_status from members where referral_code = any($1::text[])`, [candidates]);
  for (const c of candidates) { const hit = rows.find((r) => r.referral_code === c); if (hit) return hit; }
  return null;
}
