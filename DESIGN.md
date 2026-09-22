# TruLinq design system and build guide

TruLinq (live at trulinqid.com) is a verified entrepreneur network from Hilo, Hawaiʻi. "Everyone here is real." Members
prove their identity and their business, a human reviewer signs off, and their profile carries the Trulinq Verified stamp
plus a 300–850 Trulinq Score. Pages: home, directory, member profiles, match, rooms, feed, verify (application), pricing,
trust centre, contact, privacy, terms, auth (sign in / create account), dashboard, 404.

The site is a Vite multi-page app (vanilla JS modules, no framework). GSAP 3.15 (all plugins), Three.js, Lenis.
Run `npm run dev` (port 5180). Append `?nomotion` to any URL to review layout with animation disabled. Pages are folders with `index.html`; shared HTML lives in `partials/` and is injected
at build time with `<!--@include(partials/nav.html)-->`.

## The visual world (heavily inspired by the Tasa reference boards)

* **Panels on a light table.** The body is a cool light grey (`--bg #F2F6FB`). Every section is a `.panel` with a big radius
  (`--r-panel`), separated by `--panel-gap`. Panel tones are white and ice surfaces (the class names are historical):
  `.panel--cream` (`--surface`, ice white), `.panel--white` (`--surface-2`, pure white), `.panel--peach` (the ice-blue
  `--accent-2` to `--accent-3` gradient). Three drama panels stay dark on purpose: `.panel--ink` (`--deep-gradient`, passport
  blue, add `.grain`; the footer is one), `.panel--orange` (`--primary-gradient`), `.panel--violet` (`--primary-deep`). Never
  put a section directly on the body.
* **Colour.** An Apple-like light world in the trulinqid.com palette: white and ice surfaces, deep navy-black type, the
  Trulinq blues as accents. Surfaces: `--bg #F2F6FB` is the table, `--surface` the ice-white panel, `--surface-2` the white
  card (also inputs, pills, knobs), `--surface-3` the subtle fill (tracks, placeholders, segmented controls), `--accent` the
  ice-blue field (accent panels, the active nav link, highlighted cards) and `--deep-2` a stronger ice (highlighted pills,
  soft fields, the hero watermark). Type is deep navy-black `--fg #0C1526` (`--fg-2` for emphasis and hover), `--fg-soft` /
  `--fg-mute` for secondary and tertiary text, `--line` / `--line-2` for hairlines and outlines. Royal blue `--primary
  #2981FB` is the only hot colour: CTAs, the stamp, accents (`--primary-hover` on hover, `--primary-deep #093DA1` for solid
  highlights and the violet panels). `--glow` and `--sky` (both `#0B6BE0` on light) are the small accent text: notes,
  verified lines, links (`--glow-soft` for their soft fields). `--deep` / `--deep-gradient` (passport blue) carry the drama
  panels, ink cards and the footer. Deep contexts (`.panel--ink`, `.card--ink`, `.panel--orange`, `.card--orange`,
  `.panel--violet`, `.nav--ink`, `[data-tone="deep"]`) override the text, line and fill tokens in `tokens.css`, so anything
  inside them flips to light type and translucent-light fills automatically (`--glow` / `--sky` become `#4AB3FF` /
  `#60C2FF` there); elements that paint themselves with `--fg` (the default and `--ink` buttons, `.pill--ink`, the
  score-grade badge, the toast) use `--on-fg` for their text, so they are navy on light surfaces and invert inside a deep
  context. Chrome: the floating nav pill is frosted white and turns translucent passport blue while it floats over a deep
  panel (`.nav--ink`, set by `watchNavTone`); the mobile menu is a frosted-white sheet (`.menu`, near-opaque `--surface`)
  with `--fg` links; the curtain is `--surface`. `--danger #F13A35` is for errors and destructive actions only: invalid
  fields and form messages, the revoke cross, the 404 "Not verified" stamp. `.accent` words inside display headings take
  the brand gradient (`--primary-gradient` clipped to the text), like the live hero's "real". Tokens are in
  `src/styles/tokens.css`. Never invent new colours, and reach for a token rather than a literal: tokens resolve correctly
  inside deep contexts, literals do not.
* **Type (Apple-like, minimal).** One family: `Geist` for display and text (`.display` is 600 weight with -.03em
  tracking; `.display--cond` is the 700-weight tight variant for the one masked word). Data, IDs, dates, scores:
  `Geist Mono` (`.mono`). Everything is sentence case: no tracked uppercase labels anywhere. Sizes: `--fs-hero`, `--fs-1`
  (page titles), `--fs-2` (section titles), `--fs-3`, `--fs-4` (card titles), `--fs-lead`. Body is 17px / 1.47.
* **No eyebrows above section titles.** The only label above a title is the page hero's `.eyebrow` (plain grey text,
  e.g. "Pricing", "Trust Centre"). Sections open with the heading itself.
* **No decorative rules or numbering.** No hairline dividers, dashed borders, dotted leaders or inset rings used as
  decoration; separate things with space, tone (`--surface-2` on `--surface`) and `--sh-card`. Functional lines stay:
  ledger leaders, data bars, the seal's rim. Never number steps or sections (no 01, 02, 03); the active step is the one
  with the white card.
* **No decorative dots or circles.** No blue dots, no status dots, no dotted grids, no circled icons, no circled
  arrows inside buttons, no washi tape. Circles that remain are functional or the brand mark: the seal, portraits, the
  toggle knob, progress rings. Do not reintroduce these with look-alike ornaments.
* **Signature elements.**
  1. The seal: `<span class="seal seal--md" data-stamp></span>` (empty shells are auto-filled with the trulinqid.com seal:
     a navy face, a sky-to-royal rim, the rotating ring text in `--seal-text` and the TD mark in the centre; its gradients
     and the `#tq-mark` / `#tq-mark-dark` symbols are defined once in `partials/nav.html`). Sizes `seal--sm|md|lg|xl`; the tones
     `seal--ink|white|mint` still parse but draw the same seal, since the face carries its own contrast on every surface.
     `data-stamp` seals slam in on scroll (the TruLinq motion signature). Add `data-manual` when a page timeline stamps it
     itself via `stamp(el)`. The nav wordmark is the same TD mark plus "Trulinq" set in `--fg`: on light surfaces it uses the
     navy-T variant (`<use href="#tq-mark-dark">`, `.wordmark__mark--dark`) and swaps to the light T (`#tq-mark`,
     `.wordmark__mark--light`) while the nav floats over a deep panel (`.nav--ink`).
  2. Captions: `<p class="note">human-reviewed, every time</p>` inside a `position: relative` parent. Small accent-blue
     (`--glow`) typeset captions next to real UI, at most two per page. No arrows, no rotation.
  3. Ledger rows: `.ledger > .ledger__row > span, i, b` (hairline leaders, mono values) for facts, stats and receipts.
  4. Pill boards: `.pill` with emoji, tones `pill--peach|mint|violet|sky|rose|sand|ink|outline` (historical names:
     `--peach` the `--accent` field, `--violet` `--deep-2` with `--sky` text, `--mint` the `--glow-soft` field with
     `--glow` text, `--ink` an inverted navy pill: `--fg` with `--on-fg` text). Straight, evenly spaced.
  5. The mascot: a flat royal-blue monk seal with an off-white belly, navy-black pupils and a sky blush (see the FAQ on the
     homepage or `.empty` in the directory) for FAQ, empty states, 404. Its artwork colours are literal and stay the same
     on light and deep surfaces (it also peeks over the ink footer); only the parts that touch the page, the ground shadow
     and the stamp handle, are navy-black (`#0C1526`) so they read on light panels.
     It lives in `src/js/mascot.js`: `mascotSVG()` draws it (every part a `data-m-*` group), `mascotParts()` sets the pivots,
     `prime()` + `review(tl, parts, { land })` add the reviewer choreography to any timeline (pop up, eye the record, squint,
     wind up, thump so the impact lands at `land` seconds, recoil, look at you, smile, double-blink) and `idle()` gives it
     life (breathing, the stamp's tap, random blinks, cursor-following eyes, a hop on click). It appears on the homepage
     hero (watching the 3D stamp press the seal), on the "Earn the stamp" scene of How it works, in the FAQ and on the 404,
     always the same drawing and behaviours. The 404 positions it from the stage centre in units of the digit size (`--digit`).
  6. The 3D rubber stamp: `createStamp(canvas, host, options)` in `src/js/stamp3d.js` (Three.js; navy handle, blue rubber
     base, the seal on its face). The caller drives `press.t` (0 hovering, 1 pressed) and `setPointer()`; `project()` gives
     the landing spot in host pixels so DOM can be lined up under it. Used by the pricing hero (`mode: 'tip'`) and the
     homepage hero (`mode: 'straight'`, where the card is placed so its seal sits under the landing spot and the seal
     slams the instant the face touches; click the desk to press again).
* **Components** (all in `src/styles/components.css`): `.btn` (`--primary|--ink|--cream|--white|--ghost|--ghost-light`,
  `--sm|--lg`, optional trailing `.btn__icon` plain arrow; the default and `--ink` are `--fg` buttons with `--on-fg` text:
  navy on light, inverted inside deep contexts), `.pill`, `.idcard` (member card, build with `idCard(member)` from
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
  page recedes (scale .985, opacity .55), an ice-white (`--surface`) curtain rises with rounded top corners and the destination's
  name rises in `--fg` through a mask at its centre, then the browser navigates. An inline script in `partials/nav.html` paints the same
  label on the new document before its first frame, so the name holds still across the reload; the panel then lifts
  as the new hero animates in. Prefetch fires on hover/touch. First visit in a session shows the seal preloader (a single
  white stroke traces the TD monogram over the seal's navy face, then the curtain lifts); back/forward and typed URLs get a quick
  lift. `data-label` on a link overrides the derived name.
* **Nav hide/show** is direction-locked with hysteresis (`updateNav` in `src/js/main.js`): it hides only after 90px of
  deliberate downward travel past 200px, shows after 40px of upward travel or near the top, and ignores jitter,
  momentum tails, overscroll, programmatic scrolls (`scrollTo()`), the open menu, page transitions, and reveals on
  keyboard focus. Same-page anchors go through `scrollTo()`, which resolves targets to absolute positions.
* `boot()` handles: Lenis smooth scroll, the curtain (seal preloader on first load, wipe between pages), nav, and generic
  reveals. Attributes: `data-split` (masked line reveal for headlines), `data-reveal` (`up|fade|scale|left|right|stamp`,
  optional `data-delay`), `data-reveal-group` (stagger children, `data-stagger`), `data-counter="812"`, `data-bar`,
  `data-parallax=".1"`, `data-stamp` on seals, `data-marquee` on `.marquee__track` (content is cloned once).
* **The luxury layer (2026-09-22).** Four scroll-linked and pointer-linked behaviours give the site its Apple-like calm,
  and every page gets them from `boot()`: (1) every panel settles as it enters (`initPanels`: scale .975 and 55% presence
  at the bottom of the screen, full by the middle, scrubbed; the hero and pinned sections are exempt); (2) on desktop
  the homepage hero recedes and fades as the next panel comes up over it; (3) `data-reveal` entrances settle from a soft
  blur on pointer devices (never on phones); (4) a soft sky light follows the pointer across cards (`initSpotlight`,
  `.has-spot::after`, pointer devices only). Buttons carry a faint top light. Keep these when adding sections: a new
  panel needs nothing extra, a new card type only needs adding to the spotlight selector.
* Elements with CSS `transition: transform` fight GSAP: call `suspend(els)` before a GSAP transform tween and `restore(els)`
  (or `clearProps: 'transform,transition'`) after. `popIn(els, vars, trigger)` does this for sticker-style pop-ins.
* Easing: `expo.out` for entrances (1–1.4s), `expo.inOut` for wipes, `elastic.out(1,.5)` for stamps and stickers,
  `back.out(2)` for chips. Stagger 0.05–0.08 per line or card; cap cascades near 0.8s. Scrubbed sequences use `scrub: .8`,
  `anticipatePin: 1`, one pinned section per page at most. Always provide a reduced-motion path (`reduced` flag).
* **The score gauge** (`src/js/gauge.js`, shared by the homepage, profiles and the dashboard) counts once, the first
  time its section scrolls into view, and never replays: the number is a three-reel odometer (each reel turns over only
  while the reel below wraps, blurring with speed), the grade badge pops at every grade it climbs through, and the landing
  is a spring settle, a glint across the digits and a ring from the knob.
* Every page needs one choreographed hero moment and at least one page-specific interaction that means something
  (a stamp slam, a masked wipe, a ledger that fills, a card flip). Do not use the same fade-up everywhere.
* Only animate `transform` and `opacity` (plus SVG stroke props). No layout-triggering tweens.

## Quality bar

Every page is judged as a piece of graphic design in isolation: deliberate type sizes and line breaks, generous section
padding (`--sect-y`), asymmetric compositions, no generic three-column card grids without a reason, no default browser
form styling, refined hover and focus states (`:focus-visible` is handled by base.css), real content, working controls.
Check at 1440px, 1024×768 (the smallest pinned layout), 768 (tablet), 390 and 360 (phones), 375×667 (a short phone, menu
open) and 740×360 (landscape). No console errors. No horizontal overflow. Every link goes somewhere real.

### Responsive rules

* **Stacked layouts (below 1024px) get their own hero framing.** The desk camera looks lower so the scene rises into the
  stage, the card is kept inside the stage by sliding the stamp and its landing spot together (`frame()` in
  `src/js/pages/home.js`), and the desk choreography waits until the stage scrolls into view instead of playing off-screen.
* **The How-it-works progress rail** (`.how__rail` beside the steps) is the one line that is allowed: it is progress, not decoration. Its fill runs with the scrub on the pinned stage and with the scroll on stacked layouts, lighting the step its tip is in.
* **Nothing is scrubbed or offset on phones.** The stamped scene keeps its slot (no `xPercent`/`yPercent` nudge), scenes
  stack and play once as they enter.
* **Headlines re-split on resize.** `[data-split]` uses `SplitText.create({ autoSplit: true })`, so a rotated phone never
  wraps a line inside its mask; once the reveal has played, fresh lines sit at rest.
* **Touch never triggers on scroll-start.** Tap reactions (the desk press, the seal's hop) listen for `click` on touch
  devices and `pointerdown` with a mouse; every drag (globe, pricing stamp) also ends on `pointercancel`.
* **Grids never let a child dictate their width.** Grid and flex children get `min-width: 0` (components.css), long
  pills wrap under 400px, nowrap ledger lines wrap under 400px.
* **Tap targets on `(hover: none)` are at least 40px tall** (footer legal links, inline action buttons, pills).
* **The menu scrolls on short screens** (`max-height: 720px` starts the list at the top; the panel is frosted).

## Deploying

The repo is https://github.com/ausystems/TruLinq. `npm run deploy` builds with `BASE_PATH=/TruLinq/` and publishes
`dist/` to the `gh-pages` branch, which serves https://ausystems.github.io/TruLinq/. Every internal link must go through
`href()` from `src/js/ui.js` in JavaScript, and be written root-relative (`href="/pricing/"`) in HTML: the build rewrites
them for the base path. QA tooling can drive animations with `window.__gsap.ticker.tick()` when a tab is hidden.
