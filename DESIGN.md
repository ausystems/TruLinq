# TruLinq design system and build guide

Trulinq is a verified entrepreneur network from Hilo, Hawaiʻi. "Everyone here is real." Members prove their identity
and their business, a person on the review team signs off, and the profile carries the Trulinq Verified stamp and a
300–850 Trulinq Score. Pages: home, directory, member profiles, match, rooms, feed, verify, pricing, trust centre,
contact, privacy, terms, auth, dashboard, 404.

The site is a Vite multi-page app with vanilla JS modules. GSAP core runs the few animations that mean something;
Three.js draws only the rubber stamp. The members globe is a 2D canvas. Run `npm run dev` (port 5180, API on 5190).
Append `?nomotion` to any URL to review a page with motion switched off.

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

## The idea: blue ink on a verification desk

The site is the desk where a person checks every application. One colour does all the work, the way one ink does on a
desk: the Trulinq blue of the stamp pad and of the reviewer's pen. The navy of a passport cover frames the moments that
are the record itself. The composition language comes from a brand board the owner chose (tiles on a table, a navy
frame around a paper sheet, a two-tone display headline, tabs dropped on the desk, margin notes in a hand, a dotted
globe with the people on it, a round badge pressed on a frame's edge), rendered in blue with the restraint of a
premium product page: few elements per viewport, very large light type, generous space, motion only as feedback.

## The visual world

* **Sheets on a table.** The body is the table (`--bg`). Every section is a `.panel` laid on it, separated by
  `--panel-gap`. Tones: `.panel--paper` (white), `.panel--mist` (off-white), `.panel--ice` (the blue-ink tint, used
  for every page's first sheet), `.panel--navy` (passport navy, for dramatic statements) and `.panel--blue` (the
  brand blue, for closing calls to action). Neighbouring panels change tone, never repeat it.
* **The bezel.** `.bezel` is a navy cover around a `.sheet` of paper: the homepage members section, the contact
  letter, the footer and the phone menu. It is the passport motif; keep it for places that are the record or the
  ending, not for ordinary sections.
* **Deep contexts re-tune the tokens.** `.panel--navy`, `.card--navy`, `.panel--blue`, `.card--blue`, `.bezel` and
  `[data-tone="deep"]` override text, line and fill tokens, so components inside them need no special rules.
  `.sheet` and `.paper` restore the light tokens for paper placed inside a deep context. Anything that must keep the
  brand blue as a fill uses the literal `#1464DC` (`.btn--primary`, chips that are on, the disc), because `--blue-ink`
  becomes a light text blue inside deep contexts.
* **Colour.** Type is navy-black `--fg`; `--fg-soft` (7.4:1) for secondary text and `--fg-mute` (5.5:1 on white,
  4.8:1 on ice) for tertiary text and placeholders. `--blue` is the brand blue for graphics, `--blue-ink` (5.4:1 with
  white) for blue text and fills. The ice ramp (`--ice-2`, `--ice`, `--ice-3`, `--ice-4`) is the brand blue at 8, 14,
  22 and 40 percent: wells, selected rows, fields at rest. `--danger` is for errors and revocations only. Never add a
  hue; reach for a token.
* **Radius by object type.** Panels `--r-panel`, sheets `--r-sheet`, cards `--r-card` (20), wells `--r-well` (14),
  fields and buttons `--r-field` (12), rows `--r-record` (8), tags `--r-tag` (6), portraits `--r-portrait` (14).
  `--r-pill` is for chips and the grade badge, never for buttons. Circles are for the seal, avatars, the arrow disc
  inside buttons, icon buttons and progress rings.
* **Lines are structure.** `--line` inside records, `--line-2` for the edges of things you can touch, `--line-3` for
  their hover. A 1.5px navy rule opens an editorial list (quotes, the register, the dossier steps, terms in short).
* **Depth is for objects on the desk.** `--sh-chip` for tabs, `--sh-object` for records and fields that float on a
  tint, `--sh-lifted` for the member card and documents in scenes. Flat everywhere else.
* **Type.** Three voices with separate jobs. Lexend is the voice: display sizes are set large and light (400, tight
  tracking, `h1.display`), titles a step heavier (450), text at 400 and leads at 350. Geist Mono is the record: dates,
  scores, codes, references. Caveat is the reviewer's hand (`--f-hand`), used only for margin notes. Sentence case,
  no tracked uppercase labels (the seal and the disc legends are the only ring text), no eyebrows, no numbered steps.
  One word or phrase in a display line may carry the ink (`.hl`): the thing the sentence is about, not decoration.

## Signature elements

1. **The seal.** `seal({ size })` in `src/js/ui.js`, or an empty `<span class="seal seal--md"></span>` that the boot
   fills. Sizes `xs` (16), `sm` (32), `md` (64), `lg` (112), `xl`. Under 56px the compact seal drops the ring text.
   `data-manual` seals stay hidden until `stamp(el)` issues them.
   The homepage headline writes in as the page is revealed (`pageRevealed` in `src/js/main.js`): each letter rises
   out of its word 18ms after the last, leaning back into place, ending on a plain full stop. Screen readers get one sentence (`.sr-only`); the split letters are `aria-hidden`. Letters set one by one
   lose the font's kerning, so the pairs that need it carry it back as `--k` (read from Lexend 400). `html.anim`,
   set before the first paint when motion is welcome, is what lets the letters start hidden.
2. **The reviewer's notes.** `.scribble`: a few words in blue ink with a hand-drawn pen stroke
   (`.scribble__pen`, two paths with `pathLength="1"`) pointing at what they are about. Rules: one note per section
   at most, never on every page head, it states one true thing that the page also says in text (so it can be
   `aria-hidden`), and it writes itself once when first seen (`initScribbles()`; `data-manual` notes are written by
   their page, like the hero note after the stamp lands). `.scribble--inline` sits in the flow, `.scribble--label` is
   the boxed label on the blue desk. The legal pages' "In short" labels use the same hand.
3. **Tabs on the desk.** `.scatter` lays chips at small fixed angles; hovering straightens one. Used once, for the
   feature index under "trulinq features". Everywhere else chips sit straight (`.chip-row`).
4. **The disc.** `.disc` is the round call to apply, with its legend on a ring and an arrow in the middle, pressed on
   the edge of the members bezel. Its legend turns a little on hover.
5. **Portraits.** `portrait(member)` shows the member's approved photo, or a monogram in one of four fixed tones.
   Placeholders (`placeholder: true`) render a blank silhouette, never initials.
6. **The member card.** `idCard(member)`: portrait with the seal on it, name, role and business, industry and place,
   grade, score bar and score.
7. **Records.** `.ledger` rows (label, leader, value); `.register` and `.matrix` tables; `.timeline` for dated
   events; `.redact` bars for private data that exists but is never shown.
8. **The globe.** The homepage globe is an orthographic 2D canvas: a paper sphere, a faint graticule, the land as an
   even grid of blue dots (`src/data/land.js`, generated by `scripts/gen-land.mjs` from Natural Earth) and each group
   of members as monograms where they work. It draws once and again only while someone turns it.
9. **The 3D rubber stamp.** `createStamp(canvas, host, options)` in `src/js/stamp3d.js`, rendered only while pressing.
   On the homepage it presses twice: in the hero onto a real member's card, and under "Earn the stamp", where a
   smaller one, sized so its face matches the printed seal, comes down onto the sample card once the application
   reaches the third check. It squares up, presses, and the seal is printed with a ring of ink as the card takes the
   weight and its status turns from "In review" to "Trulinq Verified"; then it lifts away. Its stage (`.how__press`)
   is placed by script so the landing spot sits on the seal. `lift` raises it above its rest height so it can arrive
   and leave, `softShadow` gives it a navy blur on paper. Without WebGL the seal is simply stamped.
10. **The loader.** The same one trulinqid.com plays, matched to its timings: on deep navy, a soft blue glow that
    breathes, the mark fading and growing in from 75% over 1s, "Welcome to" rising at 0.6s and "Trulinq." (blue full
    stop) at 0.9s, then at 2.4s the whole panel fades out over 0.7s onto the page. Like the original it plays once per
    browser tab, on whichever page is opened first (`sessionStorage` `tq-intro`), never with reduced motion,
    `?nomotion` or `?nointro`. It is timed entirely in CSS in `partials/head.html`, which decides before the first
    paint (`html.has-intro`; never name a page state after a component class, `.intro` would hide the whole
    document); the lettering is outlined paths (Inter and Inter Tight, as on the original), so it never waits for a
    font. `runIntro()` in `src/js/main.js` reads the CSS animation's own clock to resolve `pageRevealed` as the fade
    starts and `introDone` when it is gone. Everything that plays "the first time it is seen" waits for `introDone`.
    The breathing glow is the one loop allowed, and only for these three seconds.
11. **The feature scenes.** Each card under "trulinq features" acts out its feature when hovered or focused (on touch
    screens, once, as it scrolls into view): a new post drops onto the feed, an offer and a need are tied with a
    "Mutual fit" knot, every room's voices are stamped, a vouch is rewritten and signed, a stamp is struck out and
    greys, the year of a stamp comes round again. At rest every card is complete; the scene is a bonus, never the
    content. Entrance delays live in the hover rules so a card lets go at once.
12. **No mascot, no animal, no cartoon character**, anywhere.

## Components (`src/styles/components.css`)

Buttons `.btn`: a label and, when it goes somewhere, a small disc carrying the arrow (`.btn__icon`) that inverts on
hover. Roles `--primary` (acts), `--ink` (commits), `--tint` (offers), `--ghost` (quiet), `--white` and `--ghost-light`
for blue panels, `--danger`; sizes 38/48/56px; `.is-busy` shows progress and disables. Text links are underlined
(`.link`, `.prose a`) or carry a chevron (`.arrow-link`). Tags `.tag`, filter `.chip`s with `aria-pressed` (on is
blue), `.segmented` (buttons or radios), fields (`.field`, `.field__label`, `.field__hint`, `.field__err`, `.input`,
`.select`, `.check`, `.switch`, `fieldset.field`), `.form-error` and `.form-note`, `.dialog`, `.toast`, `.acc`
accordions (a disc with a plus that turns blue when open), `.empty`, `.skeleton`, the score gauge (`gaugeHTML()`,
`factorsHTML()`, `runGauge()` in `src/js/gauge.js`), posts (`postHTML()`), endorsements (`.vouch-card`), `.phead`
page heads, the footer bezel and the menu.

## Forms

Labels always sit above fields; placeholders are examples, never labels. Errors appear on submit or on a server
answer, say what to do, move focus to the first problem, are announced through `aria-describedby` and disappear as
soon as the field is edited (`setInvalid()` and `clearOnEdit()` in `src/js/main.js`). A failed submission never clears
what was typed. Sensitive fields explain why they are needed. The verification application is kept in the tab's
session storage until it is submitted (never the ID document itself).

## Motion

Motion is feedback, not decoration. Allowed: the loader on arrival, the hero title writing itself, the stamp being issued (the 3D press in the
hero and under "Earn the stamp"), the reviewer's notes writing themselves once, the score being read once when first seen, the how-it-works
application moving through its three checks once, the feature scenes on hover, state changes (menu, dialogs, toggles,
chips, filters, busy buttons, the disc turning on hover), the globe turning while dragged, and the completeness ring. Not allowed: fade-ups on every
section, parallax, scroll-linked movement, pinning, floating or looping elements, cursor-following effects. Every
animation has a reduced-motion path (`reduced` in `src/js/main.js`, also forced by `?nomotion`). Pages crossfade with
the View Transitions API where supported.

## Responsive and accessibility

Check every page at 1440, 1280, 1024, 768, 414, 375 and 320px wide: no horizontal overflow, no clipped text, no
orphaned headings, touch targets at least 36px (primary actions 44px). Phones get their own compositions, not a
squeezed desktop: the hero headline re-breaks for the width, the small feature tiles pair up, margin notes that would
crowd a small screen are left out, and the header becomes a menu dialog below 1024px (a navy cover around a paper
sheet) with a focus trap, Escape to close and its own close button. Headings follow the document outline; every
section is labelled; decorative graphics are hidden from assistive technology; the globe and portraits carry text
alternatives; focus is always visible.

## Page skeleton

```html
<!doctype html>
<html lang="en" class="no-js">
<head>
  <!--@include(partials/head.html)-->
  <title>Page · Trulinq</title>
  <meta name="description" content="…">
  <script type="module" src="/src/js/pages/PAGE.js"></script>
</head>
<body>
  <!--@include(partials/nav.html)-->
  <main id="main" class="page">
    <section class="panel panel--ice xhero" aria-labelledby="…"> … </section>
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
