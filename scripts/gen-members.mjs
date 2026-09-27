/* Generates one static page per member from templates/member.html, so every profile is a real URL with its own title
   and description, plus the generic page (members/profile/) served for members who join after the build.
   Also writes the sitemap and robots.txt for the canonical site address in src/data/site.js. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const { MEMBERS } = await import(join(root, 'src/data/members.js'));
const { SITE } = await import(join(root, 'src/data/site.js'));
const tplPath = join(root, 'templates/member.html');
if (!existsSync(tplPath)) { console.log('member template not found, skipping'); process.exit(0); }
const tpl = readFileSync(tplPath, 'utf8');
const out = join(root, 'members');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);

function page(m) {
  const role = [m.role, m.company].filter(Boolean).join(' · ') || m.headline || '';
  const place = [m.city, m.region].filter(Boolean).join(', ') || m.country || '';
  const description = clip([`${m.name}${role ? `, ${[m.role, m.company].filter(Boolean).join(' at ') || role}` : ''}${place ? ` in ${place}` : ''}.`, 'A Trulinq Verified member.', m.bio].filter(Boolean).join(' '), 300);
  return tpl
    .replaceAll('{{id}}', esc(m.id))
    .replaceAll('{{title}}', esc(`${m.name} · Verified on Trulinq`))
    .replaceAll('{{description}}', esc(description))
    .replaceAll('{{name}}', esc(m.name))
    .replaceAll('{{role}}', esc(role));
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

/* Sitemap and robots for the static routes and every member page */
const routes = ['/', '/directory/', '/match/', '/rooms/', '/feed/', '/verify/', '/pricing/', '/trust/', '/contact/', '/privacy/', '/terms/', ...MEMBERS.map((m) => `/members/${m.id}/`)];
const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((r) => `  <url><loc>${esc(SITE.url + r)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(join(root, 'public/sitemap.xml'), xml);
writeFileSync(join(root, 'public/robots.txt'), `User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /auth/\nSitemap: ${SITE.url}/sitemap.xml\n`);
console.log(`generated ${MEMBERS.length} member pages, the generic profile page, sitemap and robots`);
