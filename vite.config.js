import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const SKIP = new Set(['node_modules', 'dist', 'public', 'src', 'scripts', 'partials', 'templates', '.claude', '.git']);

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

/** <!--@include(partials/nav.html)--> is replaced with the file's contents (recursive).
 *  On a sub-path deploy (GitHub Pages), root-relative links in <a> and <form> tags get the base prefix;
 *  Vite already rewrites asset and script URLs itself. */
function includePartials() {
  const RE = /<!--@include\(([^)]+)\)-->/g;
  const expand = (html, depth = 0) => {
    if (depth > 6) return html;
    return html.replace(RE, (_, file) => expand(readFileSync(resolve(root, file.trim()), 'utf8'), depth + 1));
  };
  const rebase = (html) => BASE === '/' ? html : html
    .replace(/(<a\b[^>]*?\shref=")\/(?!\/)/g, `$1${BASE}`)
    .replace(/(<form\b[^>]*?\saction=")\/(?!\/)/g, `$1${BASE}`)
    .replace(/(href="[^"]*?[?&]next=)\/(?!\/)/g, `$1${BASE}`);
  return {
    name: 'trulinq-include-partials',
    transformIndexHtml: { order: 'pre', handler: (html) => rebase(expand(html)) },
    handleHotUpdate({ file, server }) {
      if (file.includes('/partials/')) server.ws.send({ type: 'full-reload' });
    }
  };
}

export default defineConfig({
  base: BASE,
  appType: 'mpa',
  plugins: [includePartials()],
  build: {
    target: 'es2022',
    rollupOptions: { input: collectPages(root) },
    assetsInlineLimit: 0
  },
  optimizeDeps: { include: ['gsap', 'gsap/ScrollTrigger', 'gsap/SplitText', 'gsap/Flip', 'gsap/DrawSVGPlugin', 'gsap/MorphSVGPlugin', 'gsap/TextPlugin', 'lenis', 'three'] },
  server: { port: 5180, strictPort: true, host: true }
});
