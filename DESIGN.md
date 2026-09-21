# TruLinq design system and build guide

TruLinq (live at trulinqid.com) is a verified entrepreneur network from Hilo, Hawaiʻi. "Everyone here is real." Members
prove their identity and their business, a human reviewer signs off, and their profile carries the Trulinq Verified stamp
plus a 300–850 Trulinq Score. Pages: home, directory, member profiles, match, rooms, feed, verify (application), pricing,
trust centre, contact, privacy, terms, auth (sign in / create account), dashboard, 404.

The site is a Vite multi-page app (vanilla JS modules, no framework). GSAP 3.15 (all plugins), Three.js, Lenis.
Run `npm run dev` (port 5180). Append `?nomotion` to any URL to review layout with animation disabled. Pages are folders with `index.html`; shared HTML lives in `partials/` and is injected
at build time with `<!--@include(partials/nav.html)-->`.

## The visual world (heavily inspired by the Tasa reference boards)

* **Panels on a navy table.** The body is navy (`--bg #060D19`). Every section is a `.panel` with a big radius
  (`--r-panel`), separated by `--panel-gap`. Panel tones are lifted navy surfaces (the class names are historical):
  `.panel--cream` (`--surface`), `.panel--white` (`--surface-2`, one step lighter), `.panel--peach` (the `--accent` gradient),
  `.panel--ink` (`--deep-gradient`, passport blue, add `.grain`), `.panel--orange` (`--primary-gradient`), `.panel--violet`
  (`--primary-deep`). Never put a section directly on the body.
* **Colour.** The palette is lifted from trulinqid.com. Royal blue `--primary #2981FB` is the only hot colour: CTAs, the
  stamp, accents (`--primary-hover` on hover, `--primary-deep #093DA1` for solid highlights). Near-white `--fg #F4F7FB` for
  type, `--fg-soft` / `--fg-mute` for secondary and tertiary text, `--line` / `--line-2` for hairlines and outlines.
  `--glow #4AB3FF` and `--sky #60C2FF` are the small accents: notes, verified lines, links, light accent text on deep
  surfaces (`--glow-soft` for their soft fields). `--deep` / `--deep-gradient` (passport blue) carry the drama panels, ink
  cards and the menu. `--danger #F13A35` is for errors and destructive actions only: invalid fields and form messages,
  the revoke cross, the 404 "Not verified" stamp. `.accent` words inside display headings are `--primary-gradient` clipped
  to the text, like the live hero's "real". Tokens are in `src/styles/tokens.css`. Never invent new colours.
* **Type (Apple-like, minimal).** One family: `Geist` for display and text (`.display` is 600 weight with -.03em
  tracking; `.display--cond` is the 700-weight tight variant for the one masked word). Data, IDs, dates, scores:
  `Geist Mono` (`.mono`). Everything is sentence case: no tracked uppercase labels anywhere. Sizes: `--fs-hero`, `--fs-1`
  (page titles), `--fs-2` (section titles), `--fs-3`, `--fs-4` (card titles), `--fs-lead`. Body is 17px / 1.47.
* **No eyebrows above section titles.** The only label above a title is the page hero's `.eyebrow` (plain grey text,
  e.g. "Pricing", "Trust Centre"). Sections open with the heading itself.
* **No decorative dots or circles.** No blue dots, no status dots, no dotted grids, no circled icons, no circled
  arrows inside buttons, no washi tape. Circles that remain are functional or the brand mark: the seal, portraits, the
  toggle knob, progress rings. Do not reintroduce these with look-alike ornaments.
* **Signature elements.**
  1. The seal: `<span class="seal seal--md" data-stamp></span>` (empty shells are auto-filled with the trulinqid.com seal:
     a navy face, a sky-to-royal rim, the rotating ring text in `--seal-text` and the TD mark in the centre; its gradients
     and the `#tq-mark` symbol are defined once in `partials/nav.html`). Sizes `seal--sm|md|lg|xl`; the tones
     `seal--ink|white|mint` still parse but draw the same seal, since the face carries its own contrast on every surface.
     `data-stamp` seals slam in on scroll (the TruLinq motion signature). Add `data-manual` when a page timeline stamps it
     itself via `stamp(el)`. The nav wordmark is the same TD mark (`<use href="#tq-mark">`) plus "Trulinq" set in `--fg`.
  2. Captions: `<p class="note">human-reviewed, every time</p>` inside a `position: relative` parent. Small sky-blue
     (`--glow`) typeset captions next to real UI, at most two per page. No arrows, no rotation.
  3. Ledger rows: `.ledger > .ledger__row > span, i, b` (hairline leaders, mono values) for facts, stats and receipts.
  4. Pill boards: `.pill` with emoji, tones `pill--peach|mint|violet|sky|rose|sand|ink|outline` (historical names:
     `--peach` the `--accent` field, `--violet` `--deep-2` with `--sky` text, `--mint` the `--glow-soft` field with
     `--glow` text, `--ink` an inverted near-white pill). Straight, evenly spaced.
  5. The mascot: a flat royal-blue monk seal with a near-white belly and a sky blush (see the FAQ on the homepage or
     `.empty` in the directory) for FAQ, empty states, 404.
     On the 404 it is the reviewer: it pops up beside the record, squints, winds up and thumps its stamp in the same beat the
     "Not verified" mark lands, then idles (breathing, blinks, cursor-following eyes, a hop on click). Its parts are
     `data-m-*` groups in `404.html`; every transform lives on its own group so the intro, idle loops and the click
     reaction never fight over a property. The seal is positioned from the stage centre in units of the digit size (`--digit`).
* **Components** (all in `src/styles/components.css`): `.btn` (`--primary|--ink|--cream|--white|--ghost|--ghost-light`,
  `--sm|--lg`, optional trailing `.btn__icon` plain arrow), `.pill`, `.idcard` (member card, build with `idCard(member)` from
  `src/js/ui.js`), `.card` (`--peach|--ink|--orange|--sand|--outline`), `.acc` accordion (`data-single`), `.marquee`,
  form fields (`.field`, `.input`, `.select`, `.switch`, `.check`, `.segmented`), `.toast`, `.breadcrumb`, `.stat`,
  `.arrow-link`, `.empty`, `.avatar`, `.tag`, `.verified-line`, `.phero` (simple internal page hero), the score gauge
  (`gaugeHTML()`, `factorsHTML()`, `runGauge()` from `src/js/gauge.js`), posts (`postHTML()` from `ui.js`, styles in
  `src/styles/pages/member.css` under `.post`).
* **Copy voice.** Direct, anti-hype, specific. "A free stamp is a worthless stamp." Sentence case. No lorem ipsum, no
  placeholder names: use the members in `src/data/members.js` (`MEMBERS`, `byId`, `VOUCHES`) and posts in `src/data/feed.js`.
  Contact addresses: support@trulinq.com, trust@trulinq.com, privacy@trulinq.com, sales@trulinq.com. Pricing: Member (free),
  Verified Business ($19 per month, billed yearly), Enterprise (custom). Reviews finish within two business days.

## Page skeleton

```html
<!doctype html>
<html lang="en" class="no-js">
<head>
  <!--@include(partials/head.html)-->
  <title>Page — Trulinq</title>
  <meta name="description" content="…">
  <script type="module" src="/src/js/pages/PAGE.js"></script>
</head>
<body>
  <!--@include(partials/nav.html)-->
  <main id="main" class="page">
    <section class="panel panel--cream xhero"> … page hero, padding-top: calc(var(--nav-h) + clamp(56px, 8vw, 120px)) … </section>
    <section class="panel panel--white …"> … </section>
  </main>
  <!--@include(partials/footer.html)-->
</body>
</html>
```

`src/js/pages/PAGE.js`:
```js
import '../../styles/main.css';
import '../../styles/pages/PAGE.css';
import { boot, gsap, ScrollTrigger, stamp, reduced, isTouch, hydrateSeals, initStamps, popIn, suspend, restore, toast, scrollTo } from '../main.js';
boot(async () => { /* build DOM from data, before the curtain lifts */ }, () => { /* hero choreography, runs as the curtain lifts */ });
```
Each page CSS file wraps its rules in `@layer pages { … }` and gives every section an `__inner` with
`max-width: var(--max); margin: 0 auto; padding: var(--sect-y) var(--gutter);`.

## Motion rules

* **Page transitions (the chapter turn).** Clicking any internal link calls `go(url, label)` in `src/js/main.js`: the
  page recedes (scale .985, opacity .55), a navy (`--bg`) panel rises with rounded top corners and the destination's name rises
  through a mask at its centre, then the browser navigates. An inline script in `partials/nav.html` paints the same
  label on the new document before its first frame, so the name holds still across the reload; the panel then lifts
  as the new hero animates in. Prefetch fires on hover/touch. First visit in a session shows the seal preloader (a single
  near-white stroke traces the TD monogram over the seal, then the curtain lifts); back/forward and typed URLs get a quick
  lift. `data-label` on a link overrides the derived name.
* **Nav hide/show** is direction-locked with hysteresis (`updateNav` in `src/js/main.js`): it hides only after 90px of
  deliberate downward travel past 200px, shows after 40px of upward travel or near the top, and ignores jitter,
  momentum tails, overscroll, programmatic scrolls (`scrollTo()`), the open menu, page transitions, and reveals on
  keyboard focus. Same-page anchors go through `scrollTo()`, which resolves targets to absolute positions.
* `boot()` handles: Lenis smooth scroll, the curtain (seal preloader on first load, wipe between pages), nav, and generic
  reveals. Attributes: `data-split` (masked line reveal for headlines), `data-reveal` (`up|fade|scale|left|right|stamp`,
  optional `data-delay`), `data-reveal-group` (stagger children, `data-stagger`), `data-counter="812"`, `data-bar`,
  `data-parallax=".1"`, `data-stamp` on seals, `data-marquee` on `.marquee__track` (content is cloned once).
* Elements with CSS `transition: transform` fight GSAP: call `suspend(els)` before a GSAP transform tween and `restore(els)`
  (or `clearProps: 'transform,transition'`) after. `popIn(els, vars, trigger)` does this for sticker-style pop-ins.
* Easing: `expo.out` for entrances (1–1.4s), `expo.inOut` for wipes, `elastic.out(1,.5)` for stamps and stickers,
  `back.out(2)` for chips. Stagger 0.05–0.08 per line or card; cap cascades near 0.8s. Scrubbed sequences use `scrub: .8`,
  `anticipatePin: 1`, one pinned section per page at most. Always provide a reduced-motion path (`reduced` flag).
* Every page needs one choreographed hero moment and at least one page-specific interaction that means something
  (a stamp slam, a masked wipe, a ledger that fills, a card flip). Do not use the same fade-up everywhere.
* Only animate `transform` and `opacity` (plus SVG stroke props). No layout-triggering tweens.

## Quality bar

Every page is judged as a piece of graphic design in isolation: deliberate type sizes and line breaks, generous section
padding (`--sect-y`), asymmetric compositions, no generic three-column card grids without a reason, no default browser
form styling, refined hover and focus states (`:focus-visible` is handled by base.css), real content, working controls.
Check at 1440px and at 390px (phone). No console errors. No horizontal overflow. Every link goes somewhere real.

## Deploying

The repo is https://github.com/ausystems/TruLinq. `npm run deploy` builds with `BASE_PATH=/TruLinq/` and publishes
`dist/` to the `gh-pages` branch, which serves https://ausystems.github.io/TruLinq/. Every internal link must go through
`href()` from `src/js/ui.js` in JavaScript, and be written root-relative (`href="/pricing/"`) in HTML: the build rewrites
them for the base path. QA tooling can drive animations with `window.__gsap.ticker.tick()` when a tab is hidden.
