/* Turns the demo roster (src/data/*.js) into the idempotent seed migration server/db/migrations/002_seed.sql.
   Referral codes are derived from each slug, so the same member always gets the same code in every environment.
   Run once when the roster changes; the generated SQL is committed. */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const { MEMBERS, VOUCHES } = await import(join(root, 'src/data/members.js'));
const { POSTS } = await import(join(root, 'src/data/feed.js'));
const { ROOMS } = await import(join(root, 'src/data/rooms.js'));

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function codeFor(slug) {
  let n = 0;
  for (;;) {
    const h = createHash('sha256').update(`trulinq-referral:${slug}:${n}`).digest();
    let code = '';
    for (let i = 0; i < 8; i++) code += ALPHABET[h[i] % ALPHABET.length];
    if (!code.startsWith('TL')) return code;
    n++;
  }
}
const q = (v) => (v === null || v === undefined ? 'null' : typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const uuid = (key) => `md5('trulinq:${key}')::uuid`;

let sql = `-- Seed: the demo roster the site launched with. Idempotent (every insert is on conflict do nothing).\n-- Members here have no login (user_id is null); real accounts are created through sign-up or scripts/admin.mjs.\n\n`;
for (const m of MEMBERS) {
  const status = 'verified';
  sql += `insert into members (id, slug, name, first_name, role, company, city, region, country, lat, lng, industry, bio, offers, looking, website, website_verified, founded, photo, verification_status, verified_on, referral_code, followers, following, joined_on, created_at)\n` +
    `values (${uuid('member:' + m.id)}, ${q(m.id)}, ${q(m.name)}, ${q(m.first)}, ${q(m.role)}, ${q(m.company)}, ${q(m.city)}, ${q(m.region)}, ${q(m.country)}, ${q(m.lat)}, ${q(m.lng)}, ${q(m.industry)}, ${q(m.bio)}, ${q(m.offers)}, ${q(m.looking)}, ${q(m.website)}, ${m.factors[2] === 15}, ${q(m.founded || null)}, ${q(m.photo)}, ${q(status)}, ${q(m.verifiedOn)}, ${q(codeFor(m.id))}, ${m.followers}, ${m.following}, ${q(m.joined)}, ${q(m.joined + 'T12:00:00Z')})\n` +
    `on conflict (slug) do nothing;\n`;
  const [a, b, c, d, e] = m.factors;
  const total = Math.round(300 + 5.5 * (a + b + c + d + e));
  sql += `insert into member_scores (member_id, identity, profile, web, history, standing, total, source) values (${uuid('member:' + m.id)}, ${a}, ${b}, ${c}, ${d}, ${e}, ${total}, 'seed') on conflict (member_id) do nothing;\n\n`;
}
for (const p of POSTS) {
  sql += `insert into posts (id, member_id, kind, body, reply_count, created_at) values (${uuid('post:' + p.id)}, ${uuid('member:' + p.by)}, ${q(p.kind)}, ${q(p.text)}, ${p.replies}, ${q(p.at + 'Z')}) on conflict (id) do nothing;\n`;
}
sql += '\n';
ROOMS.forEach((r, i) => {
  sql += `insert into rooms (slug, name, emoji, topic, live, sort) values (${q(r.slug)}, ${q(r.name)}, ${q(r.emoji)}, ${q(r.topic)}, ${!!r.live}, ${i}) on conflict (slug) do nothing;\n`;
  for (const id of r.members) sql += `insert into room_members (room_slug, member_id) values (${q(r.slug)}, ${uuid('member:' + id)}) on conflict do nothing;\n`;
  r.messages.forEach((msg, j) => {
    sql += `insert into room_messages (id, room_slug, member_id, body, created_at) values (${uuid(`msg:${r.slug}:${j}`)}, ${q(r.slug)}, ${uuid('member:' + msg.by)}, ${q(msg.text)}, ${q(msg.at + 'Z')}) on conflict (id) do nothing;\n`;
  });
  sql += '\n';
});
for (const [to, list] of Object.entries(VOUCHES)) {
  for (const v of list) sql += `insert into endorsements (id, to_member_id, from_member_id, body, created_at) values (${uuid(`vouch:${to}:${v.from}`)}, ${uuid('member:' + to)}, ${uuid('member:' + v.from)}, ${q(v.text)}, ${q(v.date + 'T12:00:00Z')}) on conflict do nothing;\n`;
}
writeFileSync(join(root, 'server/db/migrations/002_seed.sql'), sql);
console.log(`seed written: ${MEMBERS.length} members, ${POSTS.length} posts, ${ROOMS.length} rooms`);
console.log('referral codes:', MEMBERS.map((m) => `${m.id}=${codeFor(m.id)}`).join(' '));
