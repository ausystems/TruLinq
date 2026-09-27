/* The Trulinq Score engine, the server-side source of truth for the number the site shows.
   Factors, as the live product defines them: identity & business verification 45, profile completeness 20, web
   presence 15, account history 10 (one point per three months on Trulinq), standing since verification 10 (one point
   per month the stamp has been held). total = 300 + 5.5 × sum, so 300..850.
   Members imported with the live product's factors keep them ("seed"); everyone else is computed from trusted records
   only ("engine"), never from anything a browser sends. */
import type { Queryable } from '../db/client.ts';

export interface Factors { identity: number; profile: number; web: number; history: number; standing: number }
export const totalOf = (f: Factors): number => Math.round(300 + 5.5 * (f.identity + f.profile + f.web + f.history + f.standing));
/* Bands as the live product labels them (746 → AA Excellent, 592–652 → B Fair). */
export function gradeOf(score: number): { grade: string; band: string } {
  if (score >= 740) return { grade: 'AA', band: 'Excellent' };
  if (score >= 700) return { grade: 'A', band: 'Good' };
  if (score >= 580) return { grade: 'B', band: 'Fair' };
  if (score >= 480) return { grade: 'C', band: 'Limited' };
  return { grade: 'D', band: 'Building' };
}

export interface ScoreInput {
  verification_status: string; verified_on: Date | string | null; joined_on: Date | string;
  photo: string | null; bio: string; industry: string; city: string; website: string; website_verified: boolean; founded: number | null; offers: string; looking: string;
}
const monthsBetween = (from: Date, to: Date): number => Math.max(0, (to.getTime() - from.getTime()) / (30.4375 * 864e5));
const asDate = (d: Date | string | null): Date | null => (d ? (d instanceof Date ? d : new Date(String(d).slice(0, 10) + 'T12:00:00Z')) : null);

export function computeFactors(m: ScoreInput, now = new Date()): Factors {
  const verified = m.verification_status === 'verified' && !!m.verified_on;
  const details = [m.photo, m.bio, m.industry, m.city, m.website, m.founded, m.offers, m.looking].filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length;
  const joined = asDate(m.joined_on) ?? now;
  const verifiedOn = asDate(m.verified_on);
  return {
    identity: verified ? 45 : 0,
    profile: Math.round((details / 8) * 20),
    web: m.website ? (m.website_verified ? 15 : 10) : 0,
    history: Math.min(10, Math.round(monthsBetween(joined, now) / 3)),
    standing: verified && verifiedOn ? Math.min(10, Math.round(monthsBetween(verifiedOn, now))) : 0
  };
}

/** Recompute and store an engine-sourced score. Seeded and manual rows are left as they are. */
export async function refreshScore(db: Queryable, memberId: string, now = new Date()): Promise<Factors | null> {
  const { rows } = await db.query<ScoreInput & { source: string | null }>(
    `select m.verification_status, m.verified_on, m.joined_on, m.photo, m.bio, m.industry, m.city, m.website, m.website_verified, m.founded, m.offers, m.looking, s.source
       from members m left join member_scores s on s.member_id = m.id where m.id = $1`, [memberId]);
  const m = rows[0];
  if (!m || (m.source && m.source !== 'engine')) return null;
  const f = computeFactors(m, now);
  await db.query(
    `insert into member_scores (member_id, identity, profile, web, history, standing, total, source, computed_at)
     values ($1, $2, $3, $4, $5, $6, $7, 'engine', now())
     on conflict (member_id) do update set identity = excluded.identity, profile = excluded.profile, web = excluded.web,
       history = excluded.history, standing = excluded.standing, total = excluded.total, computed_at = now()
     where member_scores.source = 'engine'`, [memberId, f.identity, f.profile, f.web, f.history, f.standing, totalOf(f)]);
  return f;
}
