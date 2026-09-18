# TruLinq — website

The marketing and product site for Trulinq, the verified entrepreneur network from Hilo, Hawaiʻi.
"Everyone here is real."

## Run it

```bash
npm install
npm run dev        # http://localhost:5180 (also regenerates member pages)
npm run build      # static output in dist/
npm run preview    # serve the production build on :4173
```

## How it is built

* **Vite multi-page app.** Every route is a folder with an `index.html` (`directory/`, `pricing/`, `members/<slug>/` …).
  Shared markup lives in `partials/` and is injected at build time by the tiny include plugin in `vite.config.js`
  (`<!--@include(partials/nav.html)-->`). Member pages are generated from `templates/member.html` by
  `scripts/gen-members.mjs`, which also writes `public/sitemap.xml` and `public/robots.txt`.
* **Vanilla JS modules.** `src/js/main.js` is the shared engine: Lenis smooth scroll synced to GSAP ScrollTrigger,
  the curtain preloader and page-to-page wipe, the floating nav, generic reveal choreography (`data-split`,
  `data-reveal`, `data-stamp`, `data-counter` …), accordions, marquees, toasts. Each page has its own script in
  `src/js/pages/` with its own choreography (Three.js globe on the homepage, Flip-driven filtering in the directory,
  the pinned verification stage, the score gauge in `src/js/gauge.js`).
* **CSS layers.** `src/styles/tokens.css` → `base.css` → `components.css` → page files in `src/styles/pages/`.
* **Data.** Demo members, endorsements, posts and rooms live in `src/data/`. The people are fictional.
* **Design guide.** `DESIGN.md` documents the visual system, components, motion rules and quality bar.

## Deploy

`npm run build` produces a fully static `dist/`. Serve it from any static host; `404.html` is the not-found page.

**GitHub Pages** (live at https://ausystems.github.io/TruLinq/): `npm run deploy` builds with `BASE_PATH=/TruLinq/`
and force-pushes `dist/` to the `gh-pages` branch, which Pages serves. Every internal link is base-path aware, so the
same code also deploys to a root domain (`trulinqid.com`) with a plain `npm run build`.
