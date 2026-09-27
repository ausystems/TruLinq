# TruLinq design system and build guide

Trulinq is a verified entrepreneur network from Hilo, Hawaiʻi. "Everyone here is real." Members prove their identity
and their business, a person on the review team signs off, and the profile carries the Trulinq Verified stamp and a
300–850 Trulinq Score. Pages: home, directory, member profiles, match, rooms, feed, verify, pricing, trust centre,
contact, privacy, terms, auth, dashboard, 404.

The site is a Vite multi-page app with vanilla JS modules. GSAP core runs the few animations that mean something;
Three.js draws the rubber stamp and the members globe. Run `npm run dev` (port 5180, API on 5190). Append `?nomotion`
to any URL to review a page with motion switched off.

## Principles

* **The site demonstrates trust instead of announcing it.** Real members, real dates, real records. Copy states what
  happened and what happens next; it does not keep insisting that things are real.
* **Only real people.** The roster in `src/data/members.js` is the verified members on the live Trulinq product plus
  Ahmad Khalid. No fictional members, no stock photography, no invented quotes, posts, endorsements or activity.
  Samples that illustrate a process are visibly generic: redacted fields, blank silhouettes, "Your name". Quotes are
  exact excerpts of members' own bios and are labelled as such (`src/data/editorial.js`).
* **One source for every shared fact.** Prices come from `src/data/billing.js`, the site address, place and emails from
  `src/data/site.js`, statistics from `statsOf()` in `src/data/stats.js`, industries from `src/data/industries.js`.
  HTML receives them as build tokens (`{{price.yearlyPerMonth}}`, `{{stats.verified}}`, `{{email.trust}}`,
  `{{site.host}}`, `{{review.businessDays}}`, `{{reverify.months}}`, `{{year}}`); an unknown token fails the build.
  The server imports the same modules (contact routing, the app origin).
* **Nothing is sticky.** No `position: sticky`, no pinned or scroll-scrubbed sequences, no smooth-scroll library, no
  JavaScript imitation of any of these. The header scrolls away with the page. The only fixed layers are the modal
  menu and transient toasts.

## The visual world

* **Panels on a table.** The body is the table (`--bg`). Every section is a `.panel` with the panel radius, separated
  by `--panel-gap`. Tones (historical class names): `.panel--cream` (`--surface`), `.panel--white` (`--surface-2`),
  `.panel--peach` (the ice gradient). Three deep panels carry weight on purpose: `.panel--ink` (passport navy; the
  footer is one), `.panel--orange` (the brand blue, used by closing calls to action) and navy cards.
* **Deep contexts re-tune the tokens.** `.panel--ink`, `.card--ink`, `.panel--orange`, `.card--orange` and
  `[data-tone="deep"]` override text, line and fill tokens, so components inside them need no special rules. Anything
  that must keep the brand blue as a fill uses the literal `#1464DC` (`.btn--primary`, `.card--orange`), because
  `--blue-ink` becomes a light text blue inside deep contexts.
* **Colour.** Type is navy-black `--fg`; `--fg-soft` (6.9:1) for secondary text and `--fg-mute` (4.6:1) for tertiary
  text and placeholders. `--blue` is the brand blue for graphics, `--blue-ink` (4.9:1 with white) for blue text and
  blue fills that carry white text. `--danger` is for errors and destructive states only. Never add colours; reach for
  a token.
* **Radius by object type, not one radius everywhere.** Panels `--r-panel`, cards `--r-card` (18), wells inside cards
  `--r-well` (14), fields, buttons and segmented controls `--r-field` (10), rows and small documents `--r-record` (8),
  tags `--r-tag` (6), portraits `--r-portrait` (12). Circles are for the seal, avatars in dense lists, nodes and
  progress rings.
* **Lines are structure, not decoration.** `--line` for rules inside records, `--line-2` for the boundaries of things
  you can touch, `--line-3` for their hover. Ledgers, registers, timelines and the how-it-works rail are the ruled
  language. No decorative dividers, dotted grids or ornament.
* **Depth is rare.** `--sh-object` and `--sh-lifted` belong to objects that sit on the page: the member card on the
  hero desk, documents in the sample scenes, the highlighted plan. Everything else is flat with a hairline.
* **Type.** One family, Geist, with Geist Mono for dates, scores, codes and references. Sentence case throughout, no
  tracked uppercase labels, no numbered steps. Sizes: `--fs-hero`, `--fs-1` page titles, `--fs-2` section titles,
  `--fs-3`, `--fs-4` card titles, `--fs-lead`, body 17px. Paragraphs are capped at readable measures.

## Signature elements

1. **The seal.** `seal({ size })` in `src/js/ui.js`, or an empty `<span class="seal seal--md"></span>` that the boot
   fills. Sizes `xs` (16), `sm` (32), `md` (64), `lg` (112), `xl`. Under 56px the compact seal drops the ring text,
   which cannot be read that small. `data-manual` seals stay hidden until `stamp(el)` issues them; that press is the
   one motion signature. Gradients and the TD mark symbols are defined once in `partials/nav.html`.
2. **Portraits.** `portrait(member)` shows the member's approved photo, or a monogram in one of four fixed tones.
   Placeholders (`placeholder: true`, used only by samples and the demo dashboard) render a blank silhouette, never
   initials that could read as a person.
3. **The member card.** `idCard(member)`: portrait with the seal on it, name, role and business, industry and place,
   grade, score bar and score. Unverified members show their status instead of a seal.
4. **Records.** `.ledger` rows (label, leader, value) for facts; `.register` and `.matrix` tables for comparisons;
   `.timeline` for dated events; `.redact` bars for private data that exists but is never shown.
5. **The 3D rubber stamp.** `createStamp(canvas, host, options)` in `src/js/stamp3d.js`. It stands still and renders
   only while pressing: the caller tweens `press.t` and calls `play(seconds)`. The homepage hero presses once when the
   desk is on screen and again on click; the pricing stamp presses once and leaves an impression.
6. **No mascot, no cartoon character**, anywhere.

## Components (`src/styles/components.css`)

Buttons `.btn` with roles `--primary` (acts), `--ink` (commits), `--ghost` (offers), `--white` and `--ghost-light` for
blue panels, `--danger`; sizes 36/44/52px; `.is-busy` shows progress and disables. Text links are underlined
(`.link`, `.prose a`) or carry an arrow (`.arrow-link`). Tags `.tag` (`--verified`, `--pending`, `--danger`, `--ink`),
filter `.chip`s with `aria-pressed`, `.segmented` (buttons or radios), fields (`.field`, `.field__label`, `.field__hint`,
`.field__err`, `.input`, `.select`, `.check`, `.switch`, `fieldset.field`), `.form-error` and `.form-note`,
`.dialog` (native modal dialogs), `.toast`, `.acc` accordions (headings wrap the buttons), `.empty`, `.skeleton`, the
score gauge (`gaugeHTML()`, `factorsHTML()`, `runGauge()` in `src/js/gauge.js`), posts (`postHTML()`), endorsements
(`.vouch-card`), the footer and the menu dialog.

## Forms

Labels always sit above fields; placeholders are examples, never labels. Errors appear on submit or on a server
answer, say what to do, move focus to the first problem, are announced through `aria-describedby` and disappear as
soon as the field is edited (`setInvalid()` and `clearOnEdit()` in `src/js/main.js`). A failed submission never clears
what was typed. Sensitive fields explain why they are needed. The verification application is kept in the tab's
session storage until it is submitted (never the ID document itself).

## Motion

Motion is feedback, not decoration. Allowed: the stamp being issued, the score being read once when first seen, the
how-it-works application moving through its three checks once, state changes (menu, dialogs, toggles, chips, filters,
busy buttons), and the completeness ring. Not allowed: fade-ups on every section, parallax, scroll-linked movement,
pinning, floating or looping elements, cursor-following effects. Every animation has a reduced-motion path (`reduced`
in `src/js/main.js`, also forced by `?nomotion`). Pages crossfade with the View Transitions API where supported.

## Responsive and accessibility

Check every page at 1440, 1280, 1024, 768, 414, 375 and 320px wide: no horizontal overflow, no clipped text, no
orphaned headings, touch targets at least 36px (primary actions 44px). The header collapses into a menu dialog below
1024px with a focus trap, Escape to close and its own close button. Headings follow the document outline; every
section is labelled; decorative graphics are hidden from assistive technology; the globe and portraits carry text
alternatives; focus is always visible.

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
    <section class="panel panel--cream xhero" aria-labelledby="…"> … </section>
  </main>
  <!--@include(partials/footer.html)-->
</body>
</html>
```

`src/js/pages/PAGE.js`:
```js
import '../../styles/main.css';
import '../../styles/pages/PAGE.css';
import { boot } from '../main.js';
boot(async () => { /* build the page from data */ }, () => { /* optional: its one meaningful moment */ });
```
Each page stylesheet wraps its rules in `@layer pages { … }` and gives every section an `__inner` with
`max-width: var(--max); margin: 0 auto; padding: var(--sect-y) var(--gutter);`.

## Deploying

`main` deploys to Vercel automatically (https://tru-linq.vercel.app). `npm run deploy` publishes the GitHub Pages copy
(https://ausystems.github.io/TruLinq/) with `BASE_PATH=/TruLinq/`. Internal links go through `href()` in JavaScript and
are written root-relative in HTML; the build rewrites them for the base path. QA in a hidden browser pane can drive
GSAP with `window.__gsap.globalTimeline` and `ticker.tick()`.
