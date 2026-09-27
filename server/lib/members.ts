/* Member records: the one query shape every route uses, and the public serialisation the frontend already expects
   (field names match src/data/members.js so the pages render unchanged). */
import type { Queryable } from '../db/client.ts';
import { isUniqueViolation } from '../db/client.ts';
import { gradeOf, totalOf, type Factors } from './score.ts';

export interface MemberRow {
  id: string; user_id: string | null; slug: string; name: string; first_name: string; role: string; company: string;
  city: string; region: string; country: string; lat: number | null; lng: number | null; industry: string; bio: string;
  offers: string; looking: string; website: string; website_verified: boolean; founded: number | null; photo: string | null;
  verification_status: 'unverified' | 'pending' | 'verified' | 'revoked'; verified_on: string | Date | null; referral_code: string;
  referred_by: string | null; followers: number; following: number; visibility: 'public' | 'private'; joined_on: string | Date;
  created_at: Date; updated_at: Date;
  s_identity: number | null; s_profile: number | null; s_web: number | null; s_history: number | null; s_standing: number | null; s_total: number | null; s_source: string | null;
}

export const MEMBER_COLUMNS = `m.id, m.user_id, m.slug, m.name, m.first_name, m.role, m.company, m.city, m.region, m.country, m.lat, m.lng, m.industry, m.bio,
  m.offers, m.looking, m.website, m.website_verified, m.founded, m.photo, m.verification_status, m.verified_on, m.referral_code, m.referred_by,
  m.followers, m.following, m.visibility, m.joined_on, m.created_at, m.updated_at,
  s.identity as s_identity, s.profile as s_profile, s.web as s_web, s.history as s_history, s.standing as s_standing, s.total as s_total, s.source as s_source`;
export const MEMBER_FROM = `from members m left join member_scores s on s.member_id = m.id`;

export interface PublicMember {
  id: string; name: string; first: string; role: string; company: string; city: string; region: string; country: string;
  lat: number | null; lng: number | null; industry: string; factors: [number, number, number, number, number]; score: number; grade: string; band: string;
  status: MemberRow['verification_status']; verifiedOn: string | null; joined: string; website: string; founded: number | null;
  followers: number; following: number; photo: string; bio: string; offers: string; looking: string;
}

const iso = (d: string | Date | null | undefined): string | null => (d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : null);

export function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || 'T';
}
/** A navy monogram, so members without a portrait still get a real image everywhere the site expects one. */
export function monogramDataUri(name: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><defs><linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#13295F"/><stop offset=".58" stop-color="#031132"/><stop offset="1" stop-color="#020C22"/></linearGradient><radialGradient id="g" cx="30%" cy="18%" r="70%"><stop offset="0" stop-color="#4AB3FF" stop-opacity=".38"/><stop offset="1" stop-color="#4AB3FF" stop-opacity="0"/></radialGradient></defs><rect width="800" height="800" fill="url(#b)"/><rect width="800" height="800" fill="url(#g)"/><text x="400" y="452" text-anchor="middle" font-family="Geist,-apple-system,Helvetica Neue,Arial,sans-serif" font-weight="600" font-size="300" letter-spacing="-22" fill="#FFFFFF">${initialsOf(name)}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function factorsOf(row: MemberRow): Factors {
  return { identity: row.s_identity ?? 0, profile: row.s_profile ?? 0, web: row.s_web ?? 0, history: row.s_history ?? 0, standing: row.s_standing ?? 0 };
}

export function serializeMember(row: MemberRow): PublicMember {
  const f = factorsOf(row);
  const score = row.s_total ?? totalOf(f);
  const g = gradeOf(score);
  return {
    id: row.slug, name: row.name, first: row.first_name, role: row.role, company: row.company, city: row.city, region: row.region, country: row.country,
    lat: row.lat, lng: row.lng, industry: row.industry, factors: [f.identity, f.profile, f.web, f.history, f.standing], score, grade: g.grade, band: g.band,
    status: row.verification_status, verifiedOn: iso(row.verified_on), joined: iso(row.joined_on) ?? iso(row.created_at) ?? '', website: row.website,
    founded: row.founded, followers: row.followers, following: row.following, photo: row.photo || monogramDataUri(row.name), bio: row.bio, offers: row.offers, looking: row.looking
  };
}

export async function memberBySlug(db: Queryable, slug: string): Promise<MemberRow | null> {
  const { rows } = await db.query<MemberRow>(`select ${MEMBER_COLUMNS} ${MEMBER_FROM} where m.slug = $1`, [slug]);
  return rows[0] ?? null;
}
export async function memberById(db: Queryable, id: string): Promise<MemberRow | null> {
  const { rows } = await db.query<MemberRow>(`select ${MEMBER_COLUMNS} ${MEMBER_FROM} where m.id = $1`, [id]);
  return rows[0] ?? null;
}
export async function memberByUserId(db: Queryable, userId: string): Promise<MemberRow | null> {
  const { rows } = await db.query<MemberRow>(`select ${MEMBER_COLUMNS} ${MEMBER_FROM} where m.user_id = $1`, [userId]);
  return rows[0] ?? null;
}

export function slugify(name: string): string {
  const s = name.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/, '');
  return s.length >= 2 ? s : 'member';
}

/** Inserts with a unique slug and a unique referral code, retrying only the collision cases. */
export async function insertMemberWithRetry<T>(insert: (slug: string, code: string) => Promise<T>, baseSlug: string, nextCode: () => string): Promise<T> {
  let attempt = 0;
  for (;;) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
    try { return await insert(slug, nextCode()); }
    catch (e) { if (!isUniqueViolation(e) || attempt > 40) throw e; attempt++; }
  }
}

export const PROFILE_DETAILS = ['photo', 'bio', 'industry', 'city', 'website', 'founded', 'offers', 'looking'] as const;
export function completeness(row: MemberRow): Record<(typeof PROFILE_DETAILS)[number], boolean> {
  return { photo: !!row.photo, bio: !!row.bio, industry: !!row.industry, city: !!row.city, website: !!row.website, founded: !!row.founded, offers: !!row.offers, looking: !!row.looking };
}
