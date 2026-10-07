/* The SEO checklist, run against the built site (dist/, after `npm run build`): `npm run check:seo`.
   For every page: one title of 30 to 60 characters and a description of 120 to 160 (pages that are indexed), a
   canonical link (and none on noindex pages), the Open Graph and X cards, structured data that parses and has what
   Google needs, exactly one h1, headings that never skip a level, alt text on every image, internal links and
   anchors that lead somewhere, no title or description used twice, and no em dashes anywhere a reader can see.
   Exits with 1 and a list when anything fails. */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
if (!existsSync(dist)) { console.error('No dist/. Run `npm run build` first.'); process.exit(1); }

const pages = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f);
    else if (e.endsWith('.html')) pages.push(f);
  }
})(dist);

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m)));
const pick = (html, re) => (re.exec(html) || [])[1];
const metaOf = (html, key) => decode(pick(html, new RegExp(`<meta\\s+(?:name|property)="${key.replace(/:/g, '\\:')}"\\s+content="([^"]*)"`)));
const visibleText = (html) => decode((html.split(/<body[^>]*>/)[1] || html)
  .replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|svg|template)\b[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' '));

const problems = [], warnings = [];
const seen = { title: new Map(), description: new Map() };
const fail = (page, msg) => problems.push(`${page}: ${msg}`);

for (const file of pages) {
  const page = '/' + relative(dist, file).replace(/\\/g, '/').replace(/index\.html$/, '');
  const html = readFileSync(file, 'utf8');
  if (/http-equiv="refresh"|location\.replace\(/.test(html) && !/<main/.test(html)) continue; // redirect pages (/join)
  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
  const title = decode(pick(html, /<title>([\s\S]*?)<\/title>/) || '').trim();
  const description = metaOf(html, 'description');

  if (!title) fail(page, 'no <title>');
  if (!noindex) {
    if (title.length < 30 || title.length > 60) fail(page, `title is ${title.length} characters (30 to 60): "${title}"`);
    if (description.length < 120 || description.length > 160) fail(page, `description is ${description.length} characters (120 to 160)`);
    const canon = pick(html, /<link rel="canonical" href="([^"]+)"/);
    if (!canon) fail(page, 'no canonical link');
    else if (!/^https:\/\//.test(canon)) fail(page, `canonical is not absolute: ${canon}`);
    for (const key of ['og:title', 'og:description', 'og:image', 'og:url', 'og:type', 'twitter:card']) if (!metaOf(html, key)) fail(page, `no ${key}`);
    for (const [kind, value] of [['title', title], ['description', description]]) {
      if (seen[kind].has(value)) fail(page, `same ${kind} as ${seen[kind].get(value)}`); else seen[kind].set(value, page);
    }
    /* structured data */
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    if (!blocks.length) fail(page, 'no structured data');
    for (const block of blocks) {
      let data;
      try { data = JSON.parse(block); } catch (e) { fail(page, `structured data does not parse: ${e.message}`); continue; }
      if (data['@context'] !== 'https://schema.org') fail(page, 'structured data @context is not https://schema.org');
      const nodes = data['@graph'] || [data];
      const types = nodes.map((n) => n['@type']);
      if (!types.some((t) => /Page$/.test(t))) fail(page, `no WebPage node (${types.join(', ')})`);
      for (const n of nodes) {
        const json = JSON.stringify(n);
        if (/"(?:url|item|contentUrl|thumbnailUrl)":"(?!https:\/\/)/.test(json)) fail(page, `${n['@type']} has a relative URL`);
        if (n['@type'] === 'BlogPosting' && n.mainEntityOfPage) {
          for (const k of ['headline', 'image', 'datePublished', 'dateModified', 'author', 'publisher']) if (!n[k]) fail(page, `BlogPosting has no ${k}`);
          if (n.headline.length > 110) fail(page, 'BlogPosting headline is over 110 characters');
          if (!n.citation || !n.citation.length) warnings.push(`${page}: the guide lists no sources`);
        }
        if (n['@type'] === 'BreadcrumbList') n.itemListElement.forEach((li, i) => { if (li.position !== i + 1 || !li.name || !li.item) fail(page, 'breadcrumb item incomplete'); });
      }
    }
  } else if (/<link rel="canonical"/.test(html)) fail(page, 'noindex page has a canonical link');

  /* headings */
  const h1s = (html.match(/<h1\b/g) || []).length;
  if (!noindex && h1s !== 1) fail(page, `${h1s} h1 elements`); // the sign-in page swaps two forms, one h1 each, one hidden
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => +m[1]);
  levels.forEach((l, i) => { if (i && l > levels[i - 1] + 1) fail(page, `heading jumps from h${levels[i - 1]} to h${l}`); });

  /* images */
  for (const img of html.match(/<img\b[^>]*>/g) || []) if (!/\salt="/.test(img)) fail(page, `image without alt: ${img.slice(0, 80)}`);

  /* links and anchors */
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, href] of html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    if (href.startsWith('#')) { if (href.length > 1 && !ids.has(decodeURIComponent(href.slice(1)))) fail(page, `anchor ${href} has no target`); continue; }
    if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/api/')) continue;
    const path = href.split(/[?#]/)[0];
    const target = path.endsWith('/') ? join(dist, path, 'index.html') : join(dist, path);
    if (!existsSync(target) && !existsSync(target + '.html') && !existsSync(join(dist, path, 'index.html'))) fail(page, `link to ${href} leads nowhere`);
  }
  /* external links that open a new tab must not hand over window.opener */
  for (const a of html.match(/<a\b[^>]*target="_blank"[^>]*>/g) || []) if (!/rel="[^"]*noopener/.test(a)) fail(page, `new-tab link without rel=noopener: ${a.slice(0, 90)}`);

  /* no em dashes where a reader can see them: text, title, description, alt and labels */
  const seenText = [visibleText(html), title, description, ...[...html.matchAll(/\s(?:alt|aria-label|title|content)="([^"]*)"/g)].map((m) => decode(m[1]))].join(' ');
  const unfinished = /\b(placeholder|lorem ipsum|todo|tbd|xxx)\b/i.exec(visibleText(html).replace(/placeholder="[^"]*"/g, ''));
  if (unfinished) fail(page, `unfinished text: "${unfinished[0]}"`);
  if (seenText.includes('—')) fail(page, `em dash: …${seenText.slice(Math.max(0, seenText.indexOf('—') - 40), seenText.indexOf('—') + 40).replace(/\s+/g, ' ')}…`);
}

const checked = pages.length;
if (warnings.length) console.log(warnings.map((w) => `warning  ${w}`).join('\n'));
if (problems.length) { console.error(problems.map((p) => `fail     ${p}`).join('\n')); console.error(`\n${problems.length} problem(s) in ${checked} pages`); process.exit(1); }
console.log(`SEO checklist passed on ${checked} pages`);
