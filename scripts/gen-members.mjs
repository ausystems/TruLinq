/* Generates one static page per member from templates/member.html, so every profile is a real URL with its own title,
   description and words (the bio and the record are written into the HTML, the same markup the page's script writes
   from live data), plus the generic page (members/profile/) served for members who join after the build.
   The sitemap, robots.txt, the feed and llms.txt come from scripts/gen-seo.mjs. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const { MEMBERS } = await import(join(root, 'src/data/members.js'));
const { SITE } = await import(join(root, 'src/data/site.js'));
const { esc, memberAboutHTML, memberDetails, ledgerHTML } = await import(join(root, 'src/js/html.js'));
const tplPath = join(root, 'templates/member.html');
if (!existsSync(tplPath)) { console.log('member template not found, skipping'); process.exit(0); }
const tpl = readFileSync(tplPath, 'utf8');
const out = join(root, 'members');

const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[,.;:]$/, '') + '…' : s);

/* A title of 30 to 60 characters and a description of 120 to 160, the lengths search results show in full. */
const roleAt = (m) => (m.role && m.company ? `${m.role} ${m.company === SITE.name ? 'of' : 'at'} ${m.company}` : m.role || m.headline || m.company || '');
function titleOf(m) {
  const what = roleAt(m);
  const tries = [
    what && `${m.name}, ${what} · Verified on Trulinq`, what && `${m.name}, ${what} · Trulinq`,
    m.company && `${m.name}, ${m.company} · Verified on Trulinq`, `${m.name} · Verified on Trulinq`, `${m.name} · Verified member on Trulinq`
  ].filter(Boolean);
  return tries.find((t) => t.length >= 30 && t.length <= 60) || tries[tries.length - 1];
}
function descriptionOf(m) {
  const what = roleAt(m);
  const place = [m.city, m.region].filter(Boolean).join(', ') || m.country || '';
  const lead = `${m.name}${what ? `, ${what}` : ''}${place ? `, ${place}` : ''}. A Trulinq Verified member, reviewed by a person.`;
  const more = m.bio && m.bio !== 'Verified entrepreneur on Trulinq.' ? m.bio : m.looking ? `Looking for: ${m.looking}` : 'See the verification record, Trulinq Score and endorsements.';
  return clip(`${lead} ${more}`, 160);
}

function page(m) {
  return tpl
    .replaceAll('{{id}}', esc(m.id))
    .replaceAll('{{title}}', esc(titleOf(m)))
    .replaceAll('{{description}}', esc(descriptionOf(m)))
    .replaceAll('{{name}}', esc(m.name))
    .replaceAll('{{role}}', esc([m.role, m.company].filter(Boolean).join(' · ')))
    .replace('<div class="mhero__bio" data-bio></div>', `<div class="mhero__bio" data-bio>${memberAboutHTML(m)}</div>`)
    .replace('<ul class="ledger mhero__details" data-details aria-label="Details"></ul>', `<ul class="ledger mhero__details" data-details aria-label="Details">${ledgerHTML(memberDetails(m, { reverifyMonths: SITE.reverifyMonths }))}</ul>`);
}

/* start clean: every member folder is regenerated from the roster, so removed members disappear */
if (existsSync(out)) for (const d of readdirSync(out)) rmSync(join(out, d), { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const m of MEMBERS) {
  mkdirSync(join(out, m.id), { recursive: true });
  writeFileSync(join(out, m.id, 'index.html'), page(m));
}
mkdirSync(join(out, 'profile'), { recursive: true });
writeFileSync(join(out, 'profile', 'index.html'), tpl
  .replaceAll('{{id}}', '__dynamic__').replaceAll('{{title}}', 'Member · Trulinq').replaceAll('{{description}}', 'A member of Trulinq, the verified network for entrepreneurs.')
  .replaceAll('{{name}}', '').replaceAll('{{role}}', '')
  .replace('<meta name="description"', '<meta name="robots" content="noindex">\n  <meta name="description"'));

console.log(`generated ${MEMBERS.length} member pages and the generic profile page`);
