import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { SITE, SITE_HOST } from './src/data/site.js';
import { BILLING } from './src/data/billing.js';
import { MEMBERS } from './src/data/members.js';
import { POSTS } from './src/data/feed.js';
import { statsOf } from './src/data/stats.js';

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

/* Build-time tokens: every shared fact written once. {{price.yearlyPerMonth}}, {{stats.verified}}, {{site.url}} and
   the rest come from src/data, the same modules the scripts and the API read, so the static HTML can never disagree
   with them. Pages that can reach the API refresh the statistics after load. A token that isn't defined fails the
   build instead of shipping as literal braces. */
const STATS = statsOf(MEMBERS, POSTS);
const TOKENS = {
  'site.url': SITE.url, 'site.host': SITE_HOST, 'site.place': SITE.place, 'site.name': SITE.name,
  'email.support': SITE.email.support, 'email.trust': SITE.email.trust, 'email.privacy': SITE.email.privacy, 'email.sales': SITE.email.sales,
  'review.businessDays': String(SITE.review.businessDays), 'reverify.months': String(SITE.reverifyMonths),
  'price.yearlyPerMonth': BILLING.yearlyPerMonth, 'price.yearlyPerYear': BILLING.yearlyPerYear,
  'price.monthlyPerMonth': BILLING.monthlyPerMonth, 'price.monthlyPerYear': BILLING.monthlyPerYear,
  'price.yearlySaves': BILLING.yearlySaves, 'price.yearlyPerDay': BILLING.yearlyPerDay,
  ...Object.fromEntries(Object.entries(STATS).map(([k, v]) => [`stats.${k}`, String(v)])),
  year: String(new Date().getFullYear())
};
const TOKEN_RE = /\{\{\s*([a-z]+(?:\.[a-zA-Z]+)*)\s*\}\}/g;

/* The canonical address of the page being built, from its file name: directory/index.html → {site}/directory/ */
function pageURL(file) {
  const rel = relative(root, file || join(root, 'index.html')).replace(/\\/g, '/');
  return SITE.url + '/' + rel.replace(/(^|\/)index\.html$/, '$1');
}

/** <!--@include(partials/nav.html)--> is replaced with the file's contents (recursive), then tokens are filled.
 *  On a sub-path deploy (GitHub Pages), root-relative links in <a> and <form> tags get the base prefix;
 *  Vite already rewrites asset and script URLs itself. */
function includePartials({ strict }) {
  const RE = /<!--@include\(([^)]+)\)-->/g;
  const expand = (html, depth = 0) => {
    if (depth > 6) return html;
    return html.replace(RE, (_, file) => expand(readFileSync(resolve(root, file.trim()), 'utf8'), depth + 1));
  };
  const fill = (html, file) => html.replace(TOKEN_RE, (whole, key) => {
    if (key === 'page.url') return pageURL(file);
    if (key in TOKENS) return TOKENS[key];
    const msg = `[trulinq] unknown token ${whole} in ${file ? relative(root, file) : 'a page'}`;
    if (strict) throw new Error(msg);
    console.warn(msg);
    return whole;
  });
  const rebase = (html) => BASE === '/' ? html : html
    .replace(/(<a\b[^>]*?\shref=")\/(?!\/)/g, `$1${BASE}`)
    .replace(/(<form\b[^>]*?\saction=")\/(?!\/)/g, `$1${BASE}`)
    .replace(/(href="[^"]*?[?&]next=)\/(?!\/)/g, `$1${BASE}`);
  return {
    name: 'trulinq-include-partials',
    transformIndexHtml: { order: 'pre', handler: (html, ctx) => rebase(fill(expand(html), ctx.filename)) },
    handleHotUpdate({ file, server }) {
      if (file.includes('/partials/')) server.ws.send({ type: 'full-reload' });
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
  plugins: [includePartials({ strict: command === 'build' }), devRewrites()],
  build: {
    target: 'es2022',
    rollupOptions: { input: collectPages(root) },
    assetsInlineLimit: 0
  },
  optimizeDeps: { include: ['gsap', 'three'] },
  /* the API runs beside Vite in development (npm run dev starts both); /api is proxied to it */
  server: { port: 5180, strictPort: true, host: true, proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 5190}`, changeOrigin: false } } }
}));
