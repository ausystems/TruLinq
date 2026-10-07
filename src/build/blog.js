/* The guides, at build time: the pieces of a guide's page that come from src/data/blog.js and from the guide's own
   words (its byline, breadcrumb, contents, reading time, related guides), and the cards on the blog index. Pages ask
   for them with <!--@render(name)--> (vite.config.js); everything here is plain HTML, written before any script
   runs, so readers and crawlers receive the whole page. */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTICLES, BLOG, articleBySlug, articlePath, plainTitle } from '../data/blog.js';
import { SITE } from '../data/site.js';
import { esc, fmtDate } from '../js/html.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const WPM = 230;
const BODY_RE = /<!--guide-body-->([\s\S]*?)<!--\/guide-body-->/;

/* ── Reading the guide's own words ─────────────────────────────── */
export const bodyOf = (html) => (BODY_RE.exec(html) || [])[1] || '';
export const textOf = (html) => String(html)
  .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&[a-z]+;|&#\d+;/gi, '')
  .replace(/\s+/g, ' ').trim();
export function readingOf(html) {
  const words = textOf(bodyOf(html)).split(' ').filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return { words, minutes: Math.max(1, Math.round(words / WPM)) };
}
const source = (slug) => { const f = join(ROOT, 'blog', slug, 'index.html'); return existsSync(f) ? readFileSync(f, 'utf8') : ''; };
export const readingOfSlug = (slug) => readingOf(source(slug));
/* the sources a guide lists at its end (<ol class="guide__sources">), for its structured data */
export function sourcesOf(html) {
  const list = (/<ol class="guide__sources"[^>]*>([\s\S]*?)<\/ol>/.exec(bodyOf(html)) || [])[1] || '';
  return [...list.matchAll(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map(([, url, name]) => ({ url, name: textOf(name) }));
}

/* ── Which guide a page is ─────────────────────────────────────── */
export function articleAt(path) {
  const m = /^\/blog\/([a-z0-9-]+)\/$/.exec(path || '');
  return m ? articleBySlug[m[1]] || null : null;
}
export const titleHTML = (a) => esc(a.title).replace(/\[([^\]]+)\]/, '<span class="hl">$1</span>');
export const ogImageOf = (a) => `${SITE.url}${articlePath(a)}og.png`;
const art = (slug) => { const f = join(ROOT, 'partials', 'art', `${slug}.html`); return existsSync(f) ? readFileSync(f, 'utf8') : ''; };

/* {{post.*}} tokens on a guide's page */
export function articleTokens(a) {
  return {
    title: esc(plainTitle(a)), titleHTML: titleHTML(a), seoTitle: esc(a.seoTitle), description: esc(a.description),
    dek: esc(a.dek), topic: esc(a.topic), short: esc(a.short), slug: a.slug
  };
}

/* ── The pieces ────────────────────────────────────────────────── */
/* A guide as a card: its art lying on a tinted well, the title (the link, stretched over the card), the line under
   the title, the topic and the reading time. */
function card(a, { level = 2 } = {}) {
  const h = `h${level}`;
  return `<article class="gcard">
      <div class="gcard__art" aria-hidden="true">${art(a.slug)}</div>
      <div class="gcard__body">
        <${h} class="gcard__title"><a href="${articlePath(a)}">${esc(plainTitle(a))}</a></${h}>
        <p class="gcard__dek">${esc(a.dek)}</p>
        <p class="gcard__meta"><span>${esc(a.topic)}</span><span>${readingOfSlug(a.slug).minutes} min read</span></p>
      </div>
    </article>`;
}

function contents(html) {
  const items = [...bodyOf(html).matchAll(/<h2\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)]
    .map(([, id, text]) => `<li><a href="#${id}">${esc(textOf(text))}</a></li>`);
  return `<nav class="guide__toc" aria-labelledby="toc-title">
          <h2 id="toc-title" class="guide__toc-title">In this guide</h2>
          <ol>${items.join('')}</ol>
        </nav>`;
}

function byline(a, html) {
  const { minutes } = readingOf(html);
  const changed = a.modified && a.modified !== a.published;
  const when = changed
    ? `Updated <time datetime="${a.modified}">${fmtDate(a.modified)}</time>`
    : `Published <time datetime="${a.published}">${fmtDate(a.published)}</time>`;
  return `<p class="guide-hero__by"><span>By <a href="/trust/">Trulinq</a></span><span>${when}</span><span>${minutes} min read</span></p>`;
}

const crumbs = (a) => `<nav class="breadcrumb guide-hero__crumbs" aria-label="Breadcrumb"><a href="/">Trulinq</a><i aria-hidden="true"></i><a href="${BLOG.path}">Blog</a><i aria-hidden="true"></i><span aria-current="page">${esc(a.short)}</span></nav>`;

/* Who wrote it, how and why: Google asks publishers to make this plain, and the EU's AI Act (Article 50) asks that
   AI-assisted text on matters of public interest say so. */
const about = (a) => `<aside class="guide__about" aria-labelledby="about-title">
          <h2 id="about-title" class="guide__about-title">About this guide</h2>
          <p>Trulinq is a network for entrepreneurs in which a person checks the identity and the business behind every member before the Trulinq Verified stamp appears. We publish these guides because the same checks help anyone deciding whom to trust.</p>
          <p><b>How it was made.</b> Researched and drafted with the help of AI, then checked claim by claim against the sources listed above, which we last reviewed on <time datetime="${a.modified}">${fmtDate(a.modified, { day: 'numeric', month: 'long', year: 'numeric' })}</time>. Trulinq is responsible for it. It is general information, not legal, financial or security advice for your situation.</p>
          <p>Found something wrong or out of date? Email <a class="link" href="mailto:${SITE.email.trust}">${SITE.email.trust}</a> and we will correct it.</p>
        </aside>`;

/* name → (html, page path) → markup */
export const RENDERS = {
  'blog-cards': () => `<div class="guides__grid">${ARTICLES.map((a) => card(a)).join('')}</div>`,
  'guide-related': (html, path) => { const a = articleAt(path); return a ? a.related.map((s) => articleBySlug[s]).filter(Boolean).map((r) => card(r, { level: 3 })).join('') : ''; },
  'guide-crumbs': (html, path) => { const a = articleAt(path); return a ? crumbs(a) : ''; },
  'guide-byline': (html, path) => { const a = articleAt(path); return a ? byline(a, html) : ''; },
  'guide-toc': (html) => contents(html),
  'guide-about': (html, path) => { const a = articleAt(path); return a ? about(a) : ''; },
  'footer-guides': () => ARTICLES.map((a) => `<a href="${articlePath(a)}">${esc(a.short)}</a>`).join('\n          ')
};
