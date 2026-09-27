/* Turns the roster (src/data/members.js, rooms.js, feed.js) into the idempotent seed migration
   server/db/migrations/002_seed.sql. Members keep their live-product ids; referral codes are the member's existing
   code where known (Tyler Shirakawa: E9EAF5) and otherwise derived from the slug, so every environment agrees.
   Run `npm run db:seed:gen` when the roster changes; the generated SQL is committed. */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const { MEMBERS, VOUCHES } = await import(join(root, 'src/data/members.js'));
const { POSTS } = await import(join(root, 'src/data/feed.js'));
const { ROOMS } = await import(join(root, 'src/data/rooms.js'));

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function codeFor(slug) {
  for (let n = 0; ; n++) {
    const h = createHash('sha256').update(`trulinq-referral:${slug}:${n}`).digest();
    let code = '';
    for (let i = 0; i < 8; i++) code += ALPHABET[h[i] % ALPHABET.length];
    if (!code.startsWith('TL')) return code;
  }
}
const q = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' || typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const memberId = (m) => (m.uid ? `'${m.uid}'::uuid` : `md5('trulinq:member:${m.id}')::uuid`);
const byId = Object.fromEntries(MEMBERS.map((m) => [m.id, m]));

let sql = `-- Seed: the Trulinq roster (verified members from trulinqid.com plus Ahmad Khalid), the four rooms, and any posts and
-- endorsements that exist. Idempotent: every insert is on conflict do nothing. Seeded members have no login
-- (user_id is null); npm run admin -- create-user --member <slug> attaches one.\n\n`;
for (const m of MEMBERS) {
  const [a, b, c, d, e] = m.factors;
  const total = Math.round(300 + 5.5 * (a + b + c + d + e));
  sql += `insert into members (id, slug, name, first_name, headline, role, company, city, region, country, lat, lng, industry, bio, offers, looking, website, website_verified, founded, photo, verification_status, verified_on, referral_code, followers, following, joined_on, created_at)\n` +
    `values (${memberId(m)}, ${q(m.id)}, ${q(m.name)}, ${q(m.first)}, ${q(m.headline)}, ${q(m.role)}, ${q(m.company)}, ${q(m.city)}, ${q(m.region)}, ${q(m.country)}, ${q(m.lat)}, ${q(m.lng)}, ${q(m.industry)}, ${q(m.bio)}, ${q(m.offers)}, ${q(m.looking)}, ${q(m.website)}, ${c === 15}, ${q(m.founded)}, ${q(m.photo)}, 'verified', ${q(m.verifiedOn)}, ${q(m.referralCode || codeFor(m.id))}, ${m.followers}, ${m.following}, ${q(m.joined)}, ${q(m.joined + 'T12:00:00Z')})\n` +
    `on conflict (slug) do nothing;\n` +
    `insert into member_scores (member_id, identity, profile, web, history, standing, total, source) values (${memberId(m)}, ${a}, ${b}, ${c}, ${d}, ${e}, ${total}, 'seed') on conflict (member_id) do nothing;\n\n`;
}
for (const p of POSTS) {
  sql += `insert into posts (id, member_id, kind, body, reply_count, created_at) values (md5('trulinq:post:${p.id}')::uuid, ${memberId(byId[p.by])}, ${q(p.kind)}, ${q(p.text)}, ${p.replies || 0}, ${q(p.at)}) on conflict (id) do nothing;\n`;
}
ROOMS.forEach((r, i) => {
  sql += `insert into rooms (slug, name, emoji, topic, live, sort) values (${q(r.slug)}, ${q(r.name)}, '', ${q(r.topic)}, false, ${i}) on conflict (slug) do nothing;\n`;
});
for (const [to, list] of Object.entries(VOUCHES)) {
  for (const v of list) sql += `insert into endorsements (id, to_member_id, from_member_id, body, created_at) values (md5('trulinq:vouch:${to}:${v.from}')::uuid, ${memberId(byId[to])}, ${memberId(byId[v.from])}, ${q(v.text)}, ${q(v.date + 'T12:00:00Z')}) on conflict do nothing;\n`;
}
writeFileSync(join(root, 'server/db/migrations/002_seed.sql'), sql);
console.log(`seed written: ${MEMBERS.length} members, ${POSTS.length} posts, ${ROOMS.length} rooms`);
console.log('referral codes:', MEMBERS.map((m) => `${m.id}=${m.referralCode || codeFor(m.id)}`).join(' '));
