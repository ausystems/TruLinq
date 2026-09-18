/* Generates one static page per member from templates/member.html so every profile is a real URL. */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const { MEMBERS } = await import(join(root, 'src/data/members.js'));
const tplPath = join(root, 'templates/member.html');
if (!existsSync(tplPath)) { console.log('member template not found yet, skipping'); process.exit(0); }
const tpl = readFileSync(tplPath, 'utf8');
const out = join(root, 'members');
if (existsSync(out)) for (const d of readdirSync(out)) if (d !== 'index.html') rmSync(join(out, d), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const m of MEMBERS) {
  const dir = join(out, m.id);
  mkdirSync(dir, { recursive: true });
  const html = tpl
    .replaceAll('{{id}}', m.id)
    .replaceAll('{{name}}', m.name)
    .replaceAll('{{role}}', m.role)
    .replaceAll('{{company}}', m.company)
    .replaceAll('{{city}}', m.city)
    .replaceAll('{{industry}}', m.industry)
    .replaceAll('{{bio}}', m.bio.replace(/"/g, '&quot;'));
  writeFileSync(join(dir, 'index.html'), html);
}
/* Sitemap + robots for the static routes and every member page */
const SITE = 'https://trulinqid.com';
const routes = ['/', '/directory/', '/match/', '/rooms/', '/feed/', '/verify/', '/pricing/', '/trust/', '/contact/', '/privacy/', '/terms/', '/auth/', ...MEMBERS.map((m) => `/members/${m.id}/`)];
const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes.map((r) => `  <url><loc>${SITE}${r}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`;
mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(join(root, 'public/sitemap.xml'), xml);
writeFileSync(join(root, 'public/robots.txt'), `User-agent: *\nAllow: /\nDisallow: /dashboard/\nSitemap: ${SITE}/sitemap.xml\n`);
console.log(`generated ${MEMBERS.length} member pages, sitemap and robots`);
