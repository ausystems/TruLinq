import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { SITE } from './src/data/site.js';
import { PRIVACY, TERMS } from './src/data/legal.js';
import { TOKENS, TOKEN_RE } from './src/build/tokens.js';
import { RENDERS as GUIDE_RENDERS, articleAt, articleTokens } from './src/build/blog.js';
import { seoHead, resolveFilm } from './src/build/seo.js';
import { esc, legalIndexHTML, legalClausesHTML } from './src/js/html.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const SKIP = new Set(['node_modules', 'dist', 'public', 'src', 'scripts', 'partials', 'templates', 'server', 'tests', 'api', '.claude', '.git']);

function collectPages(dir, out = {}) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry) || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) collectPages(full, out);
    else if (entry.endsWith('.html')) {
      const rel = relative(root, full).replace(/\\/g, '/');
      out[rel.replace(/\.html$/, '').replace(/\//g, '__') || 'index'] = full;
    }
  }
  return out;
}

const BASE = process.env.BASE_PATH || '/';

/* Build-time tokens ({{price.yearlyPerMonth}}, {{site.url}} and the rest) are defined in src/build/tokens.js. On a
   guide's page, {{post.*}} reads the guide's entry in src/data/blog.js. A token that isn't defined fails the build
   instead of shipping as literal braces. */

/* Blocks the build writes from data, so the words are in the HTML before any script runs:
   <!--@render(name)--> or <!--@render(name:argument)-->. */
const LEGAL = { privacy: PRIVACY, terms: TERMS };
const RENDERS = {
  ...GUIDE_RENDERS,
  'legal-summary': (html, path, key) => esc(LEGAL[key].summary),
  'legal-index': (html, path, key) => legalIndexHTML(LEGAL[key]),
  'legal-clauses': (html, path, key) => legalClausesHTML(LEGAL[key])
};

/* The canonical address of the page being built, from its file name: directory/index.html → {site}/directory/ */
function pagePath(file) {
  const rel = relative(root, file || join(root, 'index.html')).replace(/\\/g, '/');
  return '/' + rel.replace(/(^|\/)index\.html$/, '$1');
}
const pageURL = (file) => SITE.url + pagePath(file);

/** <!--@include(partials/nav.html)--> is replaced with the file's contents (recursive), then tokens are filled.
 *  On a sub-path deploy (GitHub Pages), root-relative links in <a> and <form> tags get the base prefix;
 *  Vite already rewrites asset and script URLs itself. */
function includePartials({ strict }) {
  const RE = /<!--@include\(([^)]+)\)-->/g;
  const expand = (html, depth = 0) => {
    if (depth > 6) return html;
    return html.replace(RE, (_, file) => expand(readFileSync(resolve(root, file.trim()), 'utf8'), depth + 1));
  };
  const fail = (msg) => { if (strict) throw new Error(msg); console.warn(msg); };
  const render = (html, file) => html.replace(/<!--@render\(([a-z-]+)(?::([a-z-]+))?\)-->/g, (whole, name, arg) => {
    if (name in RENDERS) return RENDERS[name](html, pagePath(file), arg);
    fail(`[trulinq] unknown block ${whole} in ${file ? relative(root, file) : 'a page'}`);
    return whole;
  });
  const fill = (html, file) => {
    const article = articleAt(pagePath(file));
    const post = article ? articleTokens(article) : null;
    return html.replace(TOKEN_RE, (whole, key) => {
      if (key === 'page.url') return pageURL(file);
      if (key in TOKENS) return TOKENS[key];
      if (post && key.startsWith('post.') && key.slice(5) in post) return post[key.slice(5)];
      fail(`[trulinq] unknown token ${whole} in ${file ? relative(root, file) : 'a page'}`);
      return whole;
    });
  };
  const rebase = (html) => BASE === '/' ? html : html
    .replace(/(<a\b[^>]*?\shref=")\/(?!\/)/g, `$1${BASE}`)
    .replace(/(<form\b[^>]*?\saction=")\/(?!\/)/g, `$1${BASE}`)
    .replace(/(href="[^"]*?[?&]next=)\/(?!\/)/g, `$1${BASE}`);
  return {
    name: 'trulinq-include-partials',
    transformIndexHtml: { order: 'pre', handler: (html, ctx) => rebase(fill(render(expand(html), ctx.filename), ctx.filename)) },
    handleHotUpdate({ file, server }) {
      /* partials, the guides (each card reads its guide's words) and the data blocks are built into other pages */
      if (/\/(partials|blog|src\/build|src\/data)\//.test(file)) server.ws.send({ type: 'full-reload' });
    }
  };
}

/** The head search engines and link previews read: Open Graph and X cards, robots defaults and the JSON-LD graph
 *  (src/build/seo.js). It runs last, on the finished page, so the film's fingerprinted addresses are known. */
function seo() {
  return {
    name: 'trulinq-seo',
    enforce: 'post',
    transformIndexHtml: { order: 'post', handler: (html, ctx) => seoHead(html, { path: pagePath(ctx.filename), url: pageURL(ctx.filename), base: BASE }) },
    /* the finished pages, with every asset's fingerprinted address in place */
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.html')) file.source = resolveFilm(String(file.source), BASE);
      }
    }
  };
}

/** Development parity with the Vercel rewrites in vercel.json: /join → join/index.html, and /members/<slug>/ for a
 *  member without a generated page → the generic profile page. */
function devRewrites() {
  return {
    name: 'trulinq-dev-rewrites',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname === '/join') req.url = '/join/index.html' + url.search;
        const m = /^\/members\/([a-z0-9-]+)\/?$/.exec(url.pathname);
        if (m && m[1] !== 'profile' && !existsSync(join(root, 'members', m[1], 'index.html'))) req.url = '/members/profile/index.html' + url.search;
        next();
      });
    }
  };
}

export default defineConfig(({ command }) => ({
  base: BASE,
  appType: 'mpa',
  plugins: [includePartials({ strict: command === 'build' }), seo(), devRewrites()],
  build: {
    target: 'es2022',
    rollupOptions: { input: collectPages(root) },
    assetsInlineLimit: 0
  },
  optimizeDeps: { include: ['gsap', 'three'] },
  /* the API runs beside Vite in development (npm run dev starts both); /api is proxied to it */
  server: { port: 5180, strictPort: true, host: true, proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 5190}`, changeOrigin: false } } }
}));
