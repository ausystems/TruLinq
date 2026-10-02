# TruLinq — website

The marketing and product site for Trulinq, the verified entrepreneur network from Hilo, Hawaiʻi.
"Everyone here is real."

## Run it

```bash
npm install
npm run dev        # http://localhost:5180 with the API on :5190 (also regenerates member pages)
npm run build      # static output in dist/ plus the API bundle in api/
npm run preview    # serve the production build on :4173
npm test           # backend test suite
```

## How it is built

* **Vite multi-page app.** Every route is a folder with an `index.html` (`directory/`, `pricing/`, `members/<slug>/` …).
  Shared markup lives in `partials/` and is injected at build time by the include plugin in `vite.config.js`
  (`<!--@include(partials/nav.html)-->`). Member pages are generated from `templates/member.html` by
  `scripts/gen-members.mjs`, which also writes `public/sitemap.xml` and `public/robots.txt`.
* **One source for every shared fact.** Prices (`src/data/billing.js`), the site address and contact emails
  (`src/data/site.js`), the roster (`src/data/members.js`) and the network statistics (`src/data/stats.js`) are written
  once. Static HTML receives them at build time as tokens such as `{{price.yearlyPerMonth}}` or `{{stats.verified}}`;
  an unknown token fails the build. Pages that reach the API refresh the statistics after load.
* **Vanilla JS modules.** `src/js/main.js` is the small shared engine: the menu dialog, visibility helpers, the stamp,
  form helpers, accordions, toasts and the page boot. Scrolling is native: nothing is sticky, pinned, smoothed or
  tied to the scroll position. Each page has its own script in `src/js/pages/`.
* **CSS layers.** `src/styles/tokens.css` → `base.css` → `components.css` → page files in `src/styles/pages/`.
* **People.** The roster is the verified members on the live Trulinq product plus Ahmad Khalid, nobody else. A member
  with a photo shows it; everyone else a monogram. To add one: save the original, then
  `node scripts/build-portraits.mjs --master <slug> <file> <left> <top> <size>` (a square crop, metadata stripped),
  `npm run portraits`, set `photo: '/portraits/<slug>'` in `src/data/members.js`, and add a forward migration that sets
  the same `photo` where it is still null (as `004_noah_and_portraits.sql` does). The dashboard's demo mode, shown only when accounts can't be reached, uses a nameless placeholder account.
* **Design guide.** `DESIGN.md` documents the visual system (blue ink on a verification desk: Lexend, the navy bezel,
  the reviewer's margin notes), components, motion rules and quality bar.
* **Globe data.** `src/data/land.js` is a small bitmask of land points generated from Natural Earth by
  `scripts/gen-land.mjs`; it only needs regenerating if the grid changes (see the script's header).
* **The homepage film.** `src/media/` holds the explainer in two cuts, 16:9 and a 4:5 crop for phones, with WebP
  posters made from each cut's first frame; Vite fingerprints them. They were made from the 1080p source with
  `ffmpeg -i source.mp4 [-vf crop=864:1080:528:0] -c:v libx264 -preset veryslow -tune film -crf 28 -profile:v high
  -pix_fmt yuv420p -g 48 -x264-params aq-mode=3:aq-strength=0.9 -colorspace bt709 -color_primaries bt709
  -color_trc bt709 -c:a copy -movflags +faststart`, the crop only for the 4:5 cut.

## Deploy

**Vercel** (https://tru-linq.vercel.app) deploys `main` automatically: the static pages plus the API function.
The canonical address is `SITE.url` in `src/data/site.js`; change it there if the site moves to another domain.

**GitHub Pages** (https://ausystems.github.io/TruLinq/): `npm run deploy` builds with `BASE_PATH=/TruLinq/` and
force-pushes `dist/` to the `gh-pages` branch. Every internal link is base-path aware.

## Backend

The site runs on a real backend: a Vercel Serverless Function (`api/`) over Postgres, with sign-in, member profiles,
referral codes and links, human-reviewed verification, the Trulinq Score, the feed, rooms, endorsements and the forms.
`npm run dev` starts it locally against an embedded Postgres (no setup), `npm test` runs the backend suite, and
`docs/BACKEND.md` explains the architecture, data model, security model, environment variables, migrations and deployment.
