/* Writes what crawlers read before any page: the sitemap, robots.txt, the guides' RSS feed and llms.txt, all for the
   canonical address in src/data/site.js. Runs before every build and dev start (`npm run gen`).
   A page's lastmod is the date of the last commit that changed it (and the data it is built from), so it only moves
   when the page does; a guide's is its own `modified` date in src/data/blog.js. Without git history, today. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const { SITE } = await import(join(root, 'src/data/site.js'));
const { MEMBERS } = await import(join(root, 'src/data/members.js'));
const { ARTICLES, BLOG, articlePath, plainTitle } = await import(join(root, 'src/data/blog.js'));
const { fillShared } = await import(join(root, 'src/build/tokens.js'));
const { esc } = await import(join(root, 'src/js/html.js'));

const today = new Date().toISOString().slice(0, 10);
const U = (p) => SITE.url + p;
function lastChanged(files) {
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', ...files], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(out) ? out : today;
  } catch { return today; }
}
const newest = (dates) => dates.reduce((a, b) => (a > b ? a : b));

/* every page that should be found, with the files that make it */
const PAGES = [
  ['/', ['index.html']],
  ['/directory/', ['directory/index.html']],
  ['/match/', ['match/index.html']],
  ['/rooms/', ['rooms/index.html', 'src/data/rooms.js']],
  ['/feed/', ['feed/index.html']],
  ['/verify/', ['verify/index.html']],
  ['/pricing/', ['pricing/index.html', 'src/data/billing.js']],
  ['/trust/', ['trust/index.html']],
  ['/contact/', ['contact/index.html']],
  ['/privacy/', ['privacy/index.html', 'src/data/legal.js']],
  ['/terms/', ['terms/index.html', 'src/data/legal.js']]
];
const entries = [
  ...PAGES.map(([path, files]) => ({ path, lastmod: lastChanged(files) })),
  { path: BLOG.path, lastmod: newest([lastChanged(['blog/index.html']), ...ARTICLES.map((a) => a.modified)]) },
  ...ARTICLES.map((a) => ({ path: articlePath(a), lastmod: a.modified, images: [`${articlePath(a)}og.png`] })),
  ...MEMBERS.map((m) => ({ path: `/members/${m.id}/`, lastmod: lastChanged(['src/data/members.js', 'templates/member.html']), images: m.photo ? [`${m.photo}-960.webp`] : [] }))
];

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries.map((e) => `  <url><loc>${esc(U(e.path))}</loc><lastmod>${e.lastmod}</lastmod>${(e.images || []).map((i) => `<image:image><image:loc>${esc(U(i))}</image:loc></image:image>`).join('')}</url>`).join('\n')}
</urlset>
`;

/* Crawl everything but the API. The account pages (/auth/, /dashboard/) stay crawlable so search engines can read
   their noindex; blocking them here would hide it. */
const robots = `# ${SITE.name}: ${SITE.url}
User-agent: *
Allow: /
Disallow: /api/

Sitemap: ${U('/sitemap.xml')}
`;

/* RSS 2.0 for the guides, newest first */
const rfc822 = (iso) => new Date(`${iso}T12:00:00Z`).toUTCString();
const byDate = [...ARTICLES].sort((a, b) => (b.published + b.slug > a.published + a.slug ? 1 : -1));
const feed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(BLOG.name)}</title>
    <link>${U(BLOG.path)}</link>
    <atom:link href="${U(`${BLOG.path}feed.xml`)}" rel="self" type="application/rss+xml"/>
    <description>${esc(BLOG.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${rfc822(newest(ARTICLES.map((a) => a.modified)))}</lastBuildDate>
${byDate.map((a) => `    <item>
      <title>${esc(plainTitle(a))}</title>
      <link>${U(articlePath(a))}</link>
      <guid isPermaLink="true">${U(articlePath(a))}</guid>
      <pubDate>${rfc822(a.published)}</pubDate>
      <category>${esc(a.topic)}</category>
      <description>${esc(a.description)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;

/* llms.txt: the site in a few lines and links, for language-model tools that look for it (search engines ignore it) */
const describe = (file) => {
  const html = readFileSync(join(root, file), 'utf8');
  return fillShared((/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '').replace(/&amp;/g, '&').replace(/&#39;/g, '\'').replace(/&quot;/g, '"');
};
const NAMES = { '/': 'Home', '/directory/': 'Directory', '/match/': 'Match', '/rooms/': 'Rooms', '/feed/': 'Feed', '/verify/': 'Get verified', '/pricing/': 'Pricing', '/trust/': 'Trust Centre', '/contact/': 'Contact', '/privacy/': 'Privacy policy', '/terms/': 'Terms of service' };
const llms = `# ${SITE.name}

> ${SITE.name} is a network for entrepreneurs in which a person checks the identity and the business behind every member before the Trulinq Verified stamp appears on their profile. Made in ${SITE.place}.

Membership is by invitation. Verified profiles show a 300 to 850 Trulinq Score built from verification, business details, web presence and standing over time; it is not a credit score. Identity documents are never public.

## Pages

${PAGES.map(([p, [file]]) => `- [${NAMES[p]}](${U(p)}): ${describe(file)}`).join('\n')}

## Guides

${ARTICLES.map((a) => `- [${plainTitle(a)}](${U(articlePath(a))}): ${a.description}`).join('\n')}

## Contact

- Support: ${SITE.email.support}
- Trust and safety, and reports of fakes: ${SITE.email.trust}
- Privacy: ${SITE.email.privacy}
`;

mkdirSync(join(root, 'public', 'blog'), { recursive: true });
writeFileSync(join(root, 'public/sitemap.xml'), sitemap);
writeFileSync(join(root, 'public/robots.txt'), robots);
writeFileSync(join(root, 'public/blog/feed.xml'), feed);
writeFileSync(join(root, 'public/llms.txt'), llms);
const missing = ARTICLES.filter((a) => !existsSync(join(root, 'public', articlePath(a), 'og.png'))).map((a) => a.slug);
console.log(`wrote the sitemap (${entries.length} addresses), robots.txt, the feed (${ARTICLES.length} guides) and llms.txt${missing.length ? `; no share image yet for ${missing.join(', ')}` : ''}`);
