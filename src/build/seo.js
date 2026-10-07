/* What search engines and link previews read, written into every page's head at build time (vite.config.js, after
   Vite has finished the page). Each page writes only its <title> and meta description; from those, the page's address
   and src/data this adds the Open Graph and X (Twitter) cards, the robots defaults, and one JSON-LD graph: Trulinq as
   an Organization, the WebSite, the page itself with its breadcrumb trail, and what the page is about (a guide, a
   member's profile, the plans and their prices, the film). Pages marked noindex lose their canonical link and get no
   structured data, since neither applies to a page that should not be listed. Nothing in the graph says more than the
   page itself shows. */
import { SITE } from '../data/site.js';
import { PLANS, CURRENCY } from '../data/billing.js';
import { MEMBERS } from '../data/members.js';
import { ARTICLES, BLOG, articlePath, plainTitle } from '../data/blog.js';
import { articleAt, readingOf, sourcesOf, ogImageOf } from './blog.js';

const U = (p) => SITE.url + p;
const ORG = U('/#organization'), WEBSITE = U('/#website'), LOGO = U('/#logo'), BLOG_ID = U(`${BLOG.path}#blog`);
const LANG = 'en-US';
const DEFAULT_IMAGE = { url: U('/og.png'), width: 1200, height: 630, alt: 'Trulinq, the verified network for entrepreneurs: everyone here is real' };

/* What kind of page each address is, and its name in a breadcrumb trail */
export const PAGES = {
  '/': { type: 'WebPage' },
  '/directory/': { type: 'CollectionPage', crumb: 'Directory' },
  '/match/': { type: 'WebPage', crumb: 'Match' },
  '/rooms/': { type: 'CollectionPage', crumb: 'Rooms' },
  '/feed/': { type: 'CollectionPage', crumb: 'Feed' },
  '/verify/': { type: 'WebPage', crumb: 'Get verified' },
  '/pricing/': { type: 'WebPage', crumb: 'Pricing' },
  '/trust/': { type: 'AboutPage', crumb: 'Trust Centre' },
  '/contact/': { type: 'ContactPage', crumb: 'Contact' },
  '/privacy/': { type: 'WebPage', crumb: 'Privacy policy' },
  '/terms/': { type: 'WebPage', crumb: 'Terms of service' },
  [BLOG.path]: { type: 'CollectionPage', crumb: 'Blog' }
};

/* ── Reading the page ──────────────────────────────────────────── */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decode = (s) => String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => (e[0] === '#'
  ? String.fromCodePoint(/^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
  : (ENT[e.toLowerCase()] ?? m)));
const attr = (s) => String(s ?? '').replace(/&(?!(#x[0-9a-f]+|#\d+|[a-z]+);)/gi, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const pick = (html, re) => (re.exec(html) || [])[1];
const has = (html, key) => new RegExp(`<meta\\s+(?:property|name)="${key.replace(/:/g, '\\:')}"`).test(html);
/* "Pricing for business verification · Trulinq" → "Pricing for business verification" */
const bare = (title) => title.replace(/\s+·\s+Trulinq$/, '');

/* ── The graph's nodes ─────────────────────────────────────────── */
const ref = (id) => ({ '@id': id });
function organization() {
  const team = MEMBERS.filter((m) => m.company === SITE.name && m.role);
  return {
    '@type': 'Organization', '@id': ORG, name: SITE.name, url: U('/'),
    description: 'A trusted network for entrepreneurs, built around verified identities and verified businesses. A person reviews every application before the Trulinq Verified stamp is issued.',
    slogan: 'Everyone here is real.',
    logo: { '@type': 'ImageObject', '@id': LOGO, url: U('/logo.png'), contentUrl: U('/logo.png'), width: 512, height: 512, caption: SITE.name },
    image: ref(LOGO),
    email: SITE.email.support,
    address: { '@type': 'PostalAddress', addressLocality: SITE.address.locality, addressRegion: SITE.address.region, addressCountry: SITE.address.country },
    contactPoint: [
      ['customer support', SITE.email.support], ['trust and safety', SITE.email.trust], ['privacy', SITE.email.privacy], ['sales', SITE.email.sales]
    ].map(([contactType, email]) => ({ '@type': 'ContactPoint', contactType, email, availableLanguage: 'English' })),
    sameAs: SITE.sameAs,
    ...(team.length ? { employee: team.map((m) => ({ '@type': 'Person', name: m.name, jobTitle: m.role, url: U(`/members/${m.id}/`) })) } : {})
  };
}
const website = () => ({ '@type': 'WebSite', '@id': WEBSITE, url: U('/'), name: SITE.name, description: 'The verified network for entrepreneurs.', publisher: ref(ORG), inLanguage: LANG });

function breadcrumb(url, trail) {
  return {
    '@type': 'BreadcrumbList', '@id': `${url}#breadcrumb`,
    itemListElement: [{ name: SITE.name, item: U('/') }, ...trail].map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item }))
  };
}
function webPage(type, url, name, description, extra = {}) {
  return { '@type': type, '@id': `${url}#webpage`, url, name, description, isPartOf: ref(WEBSITE), inLanguage: LANG, ...extra };
}
const imageObject = (img) => ({ '@type': 'ImageObject', url: img.url, contentUrl: img.url, width: img.width, height: img.height, caption: img.alt });

/* a guide: the post itself, its sources as citations, and its place in the blog */
function guideNodes(a, url, html, image) {
  const { words, minutes } = readingOf(html);
  const sources = sourcesOf(html);
  return [{
    '@type': 'BlogPosting', '@id': `${url}#article`, mainEntityOfPage: ref(`${url}#webpage`), isPartOf: ref(BLOG_ID),
    headline: plainTitle(a), alternativeHeadline: a.seoTitle, description: a.description,
    image: imageObject(image), datePublished: a.published, dateModified: a.modified,
    author: { '@type': 'Organization', '@id': ORG, name: SITE.name, url: U('/') }, publisher: ref(ORG),
    articleSection: a.topic, keywords: a.keywords.join(', '), wordCount: words, timeRequired: `PT${minutes}M`, inLanguage: LANG,
    ...(sources.length ? { citation: sources.map((s) => ({ '@type': 'CreativeWork', name: s.name, url: s.url })) } : {})
  }];
}
const blogNode = () => ({
  '@type': 'Blog', '@id': BLOG_ID, url: U(BLOG.path), name: BLOG.name, description: BLOG.description, publisher: ref(ORG), inLanguage: LANG,
  blogPost: ARTICLES.map((a) => ({ '@type': 'BlogPosting', '@id': U(`${articlePath(a)}#article`), url: U(articlePath(a)), headline: plainTitle(a), datePublished: a.published, dateModified: a.modified }))
});

/* a member's public profile, exactly the fields the page shows */
function person(m, url) {
  const place = [m.city, m.region].filter(Boolean).join(', ');
  return {
    '@type': 'Person', '@id': `${url}#person`, name: m.name, url,
    ...(m.role || m.headline ? { jobTitle: m.role || m.headline } : {}),
    ...(m.company ? { worksFor: m.company === SITE.name ? ref(ORG) : { '@type': 'Organization', name: m.company } } : {}),
    ...(place || m.country ? { workLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', ...(m.city ? { addressLocality: m.city } : {}), ...(m.region ? { addressRegion: m.region } : {}), ...(m.country ? { addressCountry: m.country } : {}) } } } : {}),
    ...(m.bio ? { description: m.bio } : {}),
    ...(m.industry ? { knowsAbout: m.industry } : {}),
    ...(m.photo ? { image: U(`${m.photo}-480.webp`) } : {}),
    memberOf: ref(ORG)
  };
}

/* the plans, as the pricing page lists them */
function service() {
  const offer = (name, price, unitCode, description) => ({
    '@type': 'Offer', name, price: String(price), priceCurrency: CURRENCY, url: U('/pricing/'), description,
    ...(unitCode ? { priceSpecification: { '@type': 'UnitPriceSpecification', price: String(price), priceCurrency: CURRENCY, referenceQuantity: { '@type': 'QuantitativeValue', value: 1, unitCode } } } : {})
  });
  const v = PLANS.verified;
  return {
    '@type': 'Service', '@id': U('/pricing/#service'), name: `Trulinq ${v.name}`, serviceType: 'Identity and business verification',
    description: 'A person checks your identity, your business and its presence, then issues the Trulinq Verified stamp for your profile. Re-verified every year.',
    provider: ref(ORG), url: U('/pricing/'),
    offers: [
      offer(PLANS.member.name, PLANS.member.price, null, 'A free profile in the network.'),
      offer(`${v.name}, billed yearly`, v.yearly.perYear, 'ANN', `The Trulinq Verified stamp, ${CURRENCY} ${v.yearly.perMonth} a month billed yearly.`),
      offer(`${v.name}, billed monthly`, v.monthly.perMonth, 'MON', 'The Trulinq Verified stamp, billed monthly.')
    ]
  };
}

/* the homepage film. Its addresses are fingerprinted by the build after this runs, so they are written here as
   markers and filled in from the finished page by resolveFilm() (vite.config.js, at the end of the build); in
   development they are read straight from the page. */
const FILM = { video: '__TQ_FILM_VIDEO__', poster: '__TQ_FILM_POSTER__' };
const FILM_SRC = { video: /<source\b[^>]*\bsrc="([^"]*film-16x9[^"]*\.mp4)"/, poster: /<img\b[^>]*\bsrc="([^"]*film-16x9-1440[^"]*\.webp)"/ };
const absolute = (src, base) => U('/' + src.replace(/^https?:\/\/[^/]+/, '').replace(new RegExp(`^${base.replace(/\//g, '\\/')}`), '').replace(/^\/+/, ''));
function film(html, base) {
  if (!/data-film-video/.test(html)) return null;
  const found = (k) => { const src = pick(html, FILM_SRC[k]); return src ? absolute(src, base) : FILM[k]; };
  return {
    '@type': 'VideoObject', '@id': U('/#film'), name: 'Trulinq in thirty seconds',
    description: 'A thirty-second film about Trulinq, the network where a person verifies the identity and the business behind every member.',
    thumbnailUrl: found('poster'), contentUrl: found('video'), uploadDate: '2026-09-30', duration: 'PT30S', inLanguage: LANG, publisher: ref(ORG)
  };
}
export function resolveFilm(html, base = '/') {
  if (!html.includes('__TQ_FILM_')) return html;
  const video = pick(html, FILM_SRC.video), poster = pick(html, FILM_SRC.poster);
  if (!video || !poster) throw new Error('[trulinq] the homepage film is marked up but its files were not found in the page');
  return html.replaceAll(FILM.video, absolute(video, base)).replaceAll(FILM.poster, absolute(poster, base));
}

/* ── The page's graph ──────────────────────────────────────────── */
function graph(path, { url, title, description, html, base, image }) {
  const nodes = [organization(), website()];
  const name = bare(title);
  const article = articleAt(path);
  const member = (/^\/members\/([a-z0-9-]+)\/$/.exec(path) || [])[1];
  const m = member && MEMBERS.find((x) => x.id === member);

  if (article) {
    nodes.push(webPage('WebPage', url, plainTitle(article), article.description, {
      breadcrumb: ref(`${url}#breadcrumb`), primaryImageOfPage: imageObject(image), datePublished: article.published, dateModified: article.modified, author: ref(ORG)
    }));
    nodes.push(breadcrumb(url, [{ name: PAGES[BLOG.path].crumb, item: U(BLOG.path) }, { name: plainTitle(article), item: url }]));
    nodes.push(...guideNodes(article, url, html, image));
    return nodes;
  }
  if (m) {
    nodes.push(webPage('ProfilePage', url, name, description, { breadcrumb: ref(`${url}#breadcrumb`), dateCreated: m.joined, mainEntity: ref(`${url}#person`) }));
    nodes.push(breadcrumb(url, [{ name: 'Directory', item: U('/directory/') }, { name: m.name, item: url }]));
    nodes.push(person(m, url));
    return nodes;
  }
  const page = PAGES[path] || { type: 'WebPage', crumb: name };
  const extra = path === '/' ? { about: ref(ORG), primaryImageOfPage: imageObject(image) } : { breadcrumb: ref(`${url}#breadcrumb`) };
  if (path === '/directory/') extra.mainEntity = { '@type': 'ItemList', name: 'Trulinq Verified members', numberOfItems: MEMBERS.length, itemListElement: MEMBERS.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, url: U(`/members/${x.id}/`) })) };
  if (path === BLOG.path) extra.mainEntity = ref(BLOG_ID);
  if (path === '/pricing/') extra.mainEntity = ref(U('/pricing/#service'));
  nodes.push(webPage(page.type, url, name, description, extra));
  if (path !== '/') nodes.push(breadcrumb(url, [{ name: page.crumb || name, item: url }]));
  if (path === BLOG.path) nodes.push(blogNode());
  if (path === '/pricing/') nodes.push(service());
  if (path === '/') { const v = film(html, base); if (v) nodes.push(v); }
  return nodes;
}
export function structuredData(path, page) {
  return { '@context': 'https://schema.org', '@graph': graph(path, page) };
}

/* ── The head ──────────────────────────────────────────────────── */
export function seoHead(html, { path, url, base = '/' }) {
  const title = decode(pick(html, /<title>([\s\S]*?)<\/title>/) || SITE.name).trim();
  const description = decode(pick(html, /<meta\s+name="description"\s+content="([^"]*)"/) || '');
  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
  const article = articleAt(path);
  const image = article ? { url: ogImageOf(article), width: 1200, height: 630, alt: plainTitle(article) } : DEFAULT_IMAGE;
  const meta = (kind, key, value) => `<meta ${kind}="${key}" content="${attr(value)}">`;
  const tags = [];
  const add = (kind, key, value) => { if (value != null && value !== '' && !has(html, key)) tags.push(meta(kind, key, value)); };

  if (!noindex) add('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
  add('property', 'og:type', article ? 'article' : 'website');
  add('property', 'og:site_name', SITE.name);
  add('property', 'og:locale', 'en_US');
  if (!noindex) add('property', 'og:url', url);
  add('property', 'og:title', bare(title));
  add('property', 'og:description', description);
  add('property', 'og:image', image.url);
  add('property', 'og:image:type', 'image/png');
  add('property', 'og:image:width', String(image.width));
  add('property', 'og:image:height', String(image.height));
  add('property', 'og:image:alt', image.alt);
  add('name', 'twitter:card', 'summary_large_image');
  add('name', 'twitter:title', bare(title));
  add('name', 'twitter:description', description);
  add('name', 'twitter:image', image.url);
  add('name', 'twitter:image:alt', image.alt);
  if (article) {
    add('property', 'article:published_time', article.published);
    add('property', 'article:modified_time', article.modified);
    add('property', 'article:section', article.topic);
    for (const k of article.keywords) tags.push(meta('property', 'article:tag', k));
  }

  let out = html;
  if (noindex) out = out.replace(/\s*<link rel="canonical"[^>]*>/, '');
  else {
    const json = JSON.stringify(structuredData(path, { url, title, description, html, base, image })).replace(/</g, '\\u003c');
    tags.push(`<script type="application/ld+json">${json}</script>`);
  }
  return out.replace('</head>', `  ${tags.join('\n  ')}\n</head>`);
}
