import '../../styles/main.css';
import '../../styles/pages/home.css';
import { boot, gsap, stamp, reduced, isTouch, whenVisible, whileVisible, pageRevealed, theme } from '../main.js';
import { idCard, portrait, seal, esc, href, fmtDate, relTime, scoreOf, gradeOf, roleLine, placeLine } from '../ui.js';
import { loadMembers, loadStats, loadRooms } from '../data.js';
import { FEATURED, QUOTES } from '../../data/editorial.js';
import { gaugeHTML, factorsHTML, runGauge } from '../gauge.js';
import { createStamp } from '../stamp3d.js';
import { createWash, rgb } from '../wash.js';
import { LAND } from '../../data/land.js';

let members = [], byId = {};
/* the reviewer's note beside the hero card: written once the stamp has landed */
const HERO_NOTE = `<p class="scribble hero__note" aria-hidden="true" data-manual><span class="scribble__text">checked by a person</span><svg class="scribble__pen" style="--pen-w:3.25rem" viewBox="0 0 80 48"><path pathLength="1" d="M8 44c14-4 30-16 44-36"/><path pathLength="1" d="M40 12l13-5 3 13"/></svg></p>`;
const job = (m) => [m.role, m.company].filter(Boolean).join(', ') || m.headline || '';

const STAT_LABELS = {
  people: ['person on Trulinq', 'people on Trulinq'],
  verified: ['verified profile', 'verified profiles'],
  posts: ['post shared', 'posts shared'],
  revoked: ['stamp revoked', 'stamps revoked']
};
function paintStats(st) {
  Object.entries(STAT_LABELS).forEach(([k, [one, many]]) => {
    const b = document.querySelector(`[data-stat="${k}"]`), l = document.querySelector(`[data-stat-label="${k}"]`);
    if (!b || st[k] == null) return;
    b.textContent = st[k];
    if (l) l.textContent = st[k] === 1 ? one : many;
  });
}

/* ── Data-driven parts of the page ───────────────────────────── */
async function build() {
  const [data, stats, rooms] = await Promise.all([loadMembers(), loadStats().catch(() => null), loadRooms().catch(() => [])]);
  ({ members, byId } = data);
  if (stats) paintStats(stats);

  const lead = byId[FEATURED.hero] || members[0];
  if (lead) {
    document.querySelector('[data-hero-card]').innerHTML = idCard(lead, { link: false, stamp: 'manual', sealSize: 'md' }) + HERO_NOTE;
    document.querySelector('[data-hero-caption]').innerHTML = `<a class="link" href="${href(`/members/${lead.id}/`)}">${esc(lead.name)}</a>${job(lead) ? ` · ${esc(job(lead))}` : ''}${lead.verifiedOn ? ` · Verified ${fmtDate(lead.verifiedOn)}` : ''}`;
  }

  document.querySelector('[data-world-cards]').innerHTML = FEATURED.world.map((id) => byId[id]).filter(Boolean).map((m) => idCard(m)).join('');

  const scored = byId[FEATURED.score] || members[0];
  if (scored) {
    document.querySelector('[data-gauge-mount]').innerHTML = gaugeHTML({ caption: [scored.name, scored.company].filter(Boolean).join(' · '), href: href(`/members/${scored.id}/`) });
    document.querySelector('[data-factors-mount]').innerHTML = factorsHTML(scored);
    runGauge(document.querySelector('[data-gauge-root]'), scored.factors, { trigger: document.querySelector('[data-gauge-mount]') });
  }

  const quotes = QUOTES.map((q) => ({ ...q, m: byId[q.member] })).filter((q) => q.m);
  document.querySelector('[data-quotes]').innerHTML = quotes.map(({ text, m }) => `<figure class="quote">
      <blockquote><p>“${esc(text)}”</p></blockquote>
      <figcaption><a href="${href(`/members/${m.id}/`)}">${portrait(m, { size: 40, cls: 'avatar' })}<span><b>${esc(m.name)}</b>${esc(job(m))}</span></a>${seal({ size: 'sm' })}</figcaption>
    </figure>`).join('');
  if (!quotes.length) document.querySelector('.quotes').hidden = true;

  const views = document.querySelector('[data-phone-views]');
  if (views) views.innerHTML = appViews(rooms);

  /* each room gets the seal its speakers carry; hovering the card stamps them in, one by one */
  document.querySelector('[data-room-list]').innerHTML = rooms.slice(0, 4).map((r, i) => `<li style="--i:${i}"><b>${esc(r.name)}</b>${r.lastMessageAt ? `<span>active ${relTime(r.lastMessageAt)}</span>` : ''}<span class="seal seal--xs"></span></li>`).join('');
}

/* ── The app, coming soon: the four screens, from the real roster ──
   A concept of the phone, built from the same records as the rest of the page: a member's verified profile and
   trust score, members to discover with their real scores, the real rooms, and the visitor's own stamp. Nothing on
   it is invented: no photos, no counts, no messages nobody sent. */
const SCORE_RING = 2 * Math.PI * 52;
const TICK_ICON = '<svg viewBox="0 0 24 24"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"/><path d="m9 12 2 2 4-4"/></svg>';
const CHEVRON = '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>';
function appViews(rooms) {
  const home = byId[FEATURED.app.home] || members[0];
  const found = FEATURED.app.discover.map((id) => byId[id]).filter(Boolean);
  if (!home) return '';
  const score = scoreOf(home.factors), { grade } = gradeOf(score);
  const off = SCORE_RING * (1 - (score - 300) / 550);
  const row = (i, title, sub, d) => `<div class="pv__row" data-in style="--d:${d}"><span class="pv__tick">${TICK_ICON}</span><span><b>${esc(title)}</b>${esc(sub)}</span>${CHEVRON}</div>`;
  const chips = ['All', 'Verified', ...new Set(found.map((m) => m.industry).filter(Boolean))].slice(0, 4);
  return `<div class="phone__view pv--home is-active" data-view="home">
      <div class="pv__who" data-in style="--d:0">
        <span class="pv__face">${portrait(home, { size: 96 })}<span class="pv__stamp">${seal({ size: 'sm' })}</span><i class="pv__ripple"></i></span>
        <b class="pv__name">${esc(home.name)}</b>
        <span class="pv__meta">${esc([home.role, placeLine(home)].filter(Boolean).join(' · '))}</span>
      </div>
      <div class="pv__ring" data-in style="--d:1">
        <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle class="pv__arc" cx="60" cy="60" r="52" style="--len:${SCORE_RING.toFixed(1)};--off:${off.toFixed(1)}"/></svg>
        <span class="pv__score"><b data-count="${score}">${score}</b><small>Trust score</small><em>${grade}</em></span>
      </div>
      ${row(0, 'Identity verified', 'Checked by a reviewer', 2)}
      ${row(1, 'Business verified', home.company || 'Public registry', 3)}
      ${home.factors[2] ? row(2, 'Web presence', 'Confirmed', 4) : ''}
      ${row(3, 'Verified since', fmtDate(home.verifiedOn), 5)}
    </div>
    <div class="phone__view pv--discover" data-view="discover">
      <div class="pv__search" data-in style="--d:0"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>Search verified members</div>
      <div class="pv__chips" data-in style="--d:1">${chips.map((c) => `<span${c === 'Verified' ? ' class="is-on"' : ''}>${esc(c)}</span>`).join('')}</div>
      ${found.map((m, i) => `<div class="pv__member" data-in style="--d:${i + 2}"><span class="pv__face pv__face--sm">${portrait(m, { size: 96 })}<span class="pv__stamp" style="--d:${i + 2}">${seal({ size: 'xs' })}</span></span><span><b>${esc(m.name)}</b>${esc(roleLine(m))}</span><em>${scoreOf(m.factors)}</em></div>`).join('')}
    </div>
    <div class="phone__view pv--rooms" data-view="rooms">
      <div class="pv__head" data-in style="--d:0"><b>Rooms</b>Every voice here is verified.</div>
      ${rooms.slice(0, 4).map((r, i) => `<div class="pv__room" data-in style="--d:${i + 1}"><span><b>${esc(r.name)}</b><span class="pv__topic">${esc(r.topic || '')}</span></span>${seal({ size: 'xs' })}</div>`).join('')}
    </div>
    <div class="phone__view pv--profile" data-view="profile">
      <span class="pv__big" data-in style="--d:0"><span class="pv__stamp">${seal({ size: 'md' })}</span><i class="pv__ripple"></i></span>
      <b class="pv__title" data-in style="--d:1">Trulinq Verified</b>
      <p class="pv__text" data-in style="--d:2">Your stamp shows on every profile picture, so members know you are real.</p>
      <span class="pv__cta" data-in style="--d:3">Share my invite link</span>
    </div>`;
}

/* The phone walks through its screens every 4.2 seconds while it is on screen, the way the original does; a tap on a
   tab takes over from it. The score counts up as the home screen opens. Held still for reduced motion. */
function app() {
  const stage = document.querySelector('[data-app]');
  if (!stage) return;
  const views = [...stage.querySelectorAll('[data-view]')], tabs = [...stage.querySelectorAll('[data-tab]')];
  if (!views.length) return;
  let at = 0, timer = 0, auto = !reduced, raf = 0;
  const count = (el) => {
    cancelAnimationFrame(raf);
    const to = +el.dataset.count, t0 = performance.now();
    if (reduced) { el.textContent = to; return; }
    const step = (now) => { const k = Math.min(1, (now - t0 - 200) / 1400), e = 1 - (1 - Math.max(0, k)) ** 3; el.textContent = Math.round(300 + (to - 300) * e); if (k < 1) raf = requestAnimationFrame(step); };
    el.textContent = 300; raf = requestAnimationFrame(step);
  };
  const show = (i) => {
    at = i;
    views.forEach((v, j) => v.classList.toggle('is-active', j === i));
    tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.tab === views[i].dataset.view));
    const n = views[i].querySelector('[data-count]');
    if (n) count(n);
  };
  const run = (on) => { clearInterval(timer); if (on && auto) timer = setInterval(() => show((at + 1) % views.length), 4200); };
  tabs.forEach((t) => t.addEventListener('click', () => { auto = false; run(false); show(views.findIndex((v) => v.dataset.view === t.dataset.tab)); }));
  let live = false;
  whileVisible(stage, (seen) => {
    if (seen && !live) { live = true; stage.classList.add('is-live'); show(0); }
    run(seen);
  });
}

/* ── Hero: the ink wash under it ───────────────────────────────
   The brand's blue tints, read from the tokens, laid out around the page's own layout: the palest paper under the
   headline and the copy, the 40 percent tint pooled behind the stamp and the member's card and turning slowly around
   them, the 22 percent tint along the far edge, the sky (let 30 percent into paper) along the top, and ice along the
   foot. Stacked, the card sits under the copy, so the tints move with it. Everything drifts on loops of fifteen seconds
   to over a minute; it holds still for reduced motion and off screen, and steps aside for forced colours and more
   contrast. */
function heroWash() {
  const hero = document.querySelector('.hero'), canvas = hero && hero.querySelector('[data-hero-wash]');
  if (!canvas) return;
  if (matchMedia('(forced-colors: active), (prefers-contrast: more)').matches) { canvas.remove(); return; }
  /* The palette is read from the tokens each time it is needed, so the same layout is pale blue ink on paper by day
     and deep blue on the night desk; at night the sky glow is mixed in more lightly. */
  const layouts = () => {
    const css = getComputedStyle(document.documentElement);
    const tok = (name, fallback) => rgb(css.getPropertyValue(name)) || rgb(fallback);
    const paper = tok('--surface-2', '#FFFFFF'), ice2 = tok('--ice-2', '#F1F6FE'), ice = tok('--ice', '#E6EFFD');
    const ice3 = tok('--ice-3', '#D3E4FD'), ice4 = tok('--ice-4', '#A9CDFD');
    const glow = theme() === 'dark' ? .22 : .3;
    const sky = tok('--sky', '#7FCBFF').map((v, i) => paper[i] + (v - paper[i]) * glow);
    const pt = (color, x, y, size, ax, ay, fx, fy, bias = 0) => ({ color, x, y, size, ax, ay, fx, fy, bias });
    /* x, y: where the point sits (0..1 of the panel); size, and how far and fast it drifts, in units of the panel's short
       side; bias lets the pool behind the card hold its ground */
    const WIDE = {
      swirl: { x: .77, y: .36, angle: 1, reach: 5 },
      points: [
        pt(paper, .25, .3, .32, .07, .05, .21, .16),
        pt(ice2, .18, .66, .32, .08, .05, .17, .22),
        pt(ice, .02, .04, .3, .05, .05, .13, .18),
        pt(sky, .5, .03, .3, .12, .04, .19, .12),
        pt(ice3, .94, .08, .3, .05, .06, .15, .2),
        pt(ice4, .77, .34, .22, .04, .04, .12, .17, .15),
        pt(ice3, .99, .46, .24, .03, .05, .23, .14),
        pt(paper, .7, .79, .3, .06, .03, .14, .21),
        pt(ice, .4, .98, .32, .12, .03, .11, .19),
        pt(ice2, .96, .95, .28, .04, .03, .16, .13)
      ]
    };
    const STACKED = {
      swirl: { x: .5, y: .52, angle: .9, reach: 5 },
      points: [
        pt(paper, .3, .06, .35, .1, .04, .21, .16),
        pt(ice2, .75, .2, .3, .08, .04, .17, .22),
        pt(paper, .35, .32, .35, .08, .04, .13, .18),
        pt(sky, .97, .02, .28, .05, .04, .19, .12),
        pt(ice, .02, .12, .26, .04, .04, .15, .2),
        pt(ice4, .5, .52, .2, .05, .03, .12, .17, .15),
        pt(ice3, .98, .47, .26, .04, .04, .23, .14),
        pt(sky, .02, .6, .26, .04, .04, .11, .19),
        pt(paper, .45, .71, .32, .08, .03, .16, .13),
        pt(ice, .5, .97, .35, .12, .03, .14, .21)
      ]
    };
    return { WIDE, STACKED };
  };
  const wide = matchMedia('(min-width: 1024px)');
  const pick = () => layouts()[wide.matches ? 'WIDE' : 'STACKED'];
  let wash;
  try { wash = createWash(canvas, { layout: pick(), warp: .06, waves: 2.4, speed: 1.6 }); }
  catch (e) { console.info('[trulinq] ink wash unavailable', e); canvas.remove(); return; }
  window.__wash = wash; // lets automated checks draw any moment
  /* Small blue text keeps AA contrast (4.5:1) whatever drifts under it: the link beside the button, the caption, the
     motto, and the reviewer's note while it is set under 24px. The ink is held to a limit there, measured to the text
     itself: above a floor on paper, below a ceiling at night, where the text is light. The layout already keeps the
     strongest tints away from them, so the limit only ever acts a little. */
  const limit = () => (theme() === 'dark' ? wash.limit(.05, -1) : wash.limit(.85, 1));
  limit();
  const SMALL = ['.hero__cta .arrow-link', '.hero__caption', '.hero__motto', '.hero__note .scribble__text'];
  const range = document.createRange();
  const isSmall = (el) => { const cs = getComputedStyle(el), px = parseFloat(cs.fontSize); return px < 24 && !(px >= 18.66 && +cs.fontWeight >= 700); };
  const measure = () => {
    const cr = canvas.getBoundingClientRect();
    wash.keep(SMALL.map((sel) => hero.querySelector(sel)).filter((el) => el && isSmall(el)).map((el) => { range.selectNodeContents(el); return range.getBoundingClientRect(); })
      .filter((r) => r.width && r.height)
      .map((r) => [r.left - cr.left, r.top - cr.top, r.right - cr.left, r.bottom - cr.top]));
  };
  measure();
  wash.draw(0);
  requestAnimationFrame(() => canvas.classList.add('is-on'));
  wide.addEventListener('change', () => wash.setLayout(pick()));
  window.addEventListener('themechange', () => { wash.setLayout(pick()); limit(); });
  new ResizeObserver(() => { wash.resize(); measure(); }).observe(canvas);
  /* the caption, the numbers and the card are written once the members load, the card is then laid on the desk, and
     the fonts can reflow the rest */
  new MutationObserver(measure).observe(hero, { childList: true, subtree: true, characterData: true });
  new MutationObserver(measure).observe(hero.querySelector('[data-hero-card]'), { attributes: true, attributeFilter: ['style', 'class'] });
  document.fonts.ready.then(measure);
  canvas.addEventListener('washlost', () => canvas.classList.remove('is-on'));
  canvas.addEventListener('washrestored', () => canvas.classList.add('is-on'));
  if (!reduced) whileVisible(hero, (seen) => wash.play(seen));
}

/* ── Hero: the stamp presses the seal onto a real member's card ── */
async function hero() {
  /* the title writes itself as the page arrives */
  pageRevealed.then(() => { const split = document.querySelector('.hero__split'); if (split) split.classList.add('is-go'); });
  const stage = document.querySelector('[data-hero-stage]');
  const desk = stage.querySelector('.hero__desk');
  const cardWrap = stage.querySelector('[data-hero-card]');
  const card = cardWrap.querySelector('.idcard');
  if (!card) return;
  const sealEl = card.querySelector('.seal');
  const canvas = stage.querySelector('[data-hero-stamp]');
  const note = cardWrap.querySelector('.hero__note');
  const stacked = matchMedia('(max-width: 1023px)');
  const write = () => note && note.classList.add('is-written');

  /* the card lies on the desk */
  gsap.set(card, { rotationX: 34, rotationZ: -6, rotationY: 4, transformPerspective: 1400, transformOrigin: '50% 50%' });

  let S;
  try {
    S = await createStamp(canvas, desk, {
      mode: 'straight', fov: 30, camPos: [0, 3.6, 9.4], look: [0, .8, 0], scale: .56,
      rest: { x: -.32, y: -.7, z: .08 }, restY: .95, dropY: 1, shadowY: -.02, shadowOpacity: .05, position: [-.1, 0, .4]
    });
  } catch (e) {
    /* no WebGL: the card is shown on its own, already stamped */
    console.info('[trulinq] 3D stamp unavailable', e);
    canvas.remove();
    Object.assign(cardWrap.style, { left: '50%', top: '46%', transform: 'translate(-50%, -50%)' });
    if (sealEl) sealEl.classList.add('is-stamped');
    cardWrap.classList.add('is-placed');
    write();
    return;
  }

  const BASE_X = -.1, LAND = [BASE_X, -.06, .4];
  /* put the card's seal exactly under the stamp's landing spot (desk pixels) */
  const place = () => {
    const land = S.project(...LAND);
    const hr = desk.getBoundingClientRect(), sr = sealEl.getBoundingClientRect(), wr = cardWrap.getBoundingClientRect();
    cardWrap.style.left = `${(wr.left - hr.left) + (land.x - (sr.left + sr.width / 2 - hr.left))}px`;
    cardWrap.style.top = `${(wr.top - hr.top) + (land.y - (sr.top + sr.height / 2 - hr.top))}px`;
  };
  /* Frame the desk for the layout, then keep the whole card inside it: if it would run past an edge, the stamp and
     its landing spot slide over with it, so the seal still lands exactly under the press. */
  const shift = (du) => { LAND[0] = BASE_X + du; S.group.position.x = BASE_X + du; S.shadow.position.x = BASE_X + du; };
  const frame = () => {
    S.resize();
    S.camera.lookAt(0, stacked.matches ? .38 : .8, 0);
    S.camera.updateMatrixWorld();
    shift(0); place();
    const hr = desk.getBoundingClientRect(), cr = card.getBoundingClientRect(), pad = 6;
    const dx = cr.right > hr.right - pad ? (hr.right - pad) - cr.right : cr.left < hr.left + pad ? (hr.left + pad) - cr.left : 0;
    if (dx) { const a = S.project(...LAND), b = S.project(LAND[0] + 1, LAND[1], LAND[2]); shift(dx / (b.x - a.x)); place(); }
    S.render();
    cardWrap.classList.add('is-placed');
  };
  frame();
  new ResizeObserver(frame).observe(desk);

  if (reduced) { sealEl.classList.add('is-stamped'); write(); return; }

  /* the impact: the seal lands, the card takes the hit */
  const thud = () => {
    if (!sealEl.classList.contains('is-stamped')) stamp(sealEl, { rotate: -7 });
    else gsap.fromTo(sealEl, { scale: .88 }, { scale: 1, duration: .8, ease: 'elastic.out(1, .45)' });
    gsap.timeline().to(card, { y: 8, duration: .1, ease: 'power2.out' }).to(card, { y: 0, duration: .8, ease: 'elastic.out(1, .45)' });
    setTimeout(write, 350);
  };
  let pressing = false;
  const press = (delay = 0) => {
    pressing = true;
    S.play(delay + 1.8);
    gsap.timeline({ delay, onComplete: () => (pressing = false) })
      .to(S.press, { t: 1, duration: .36, ease: 'power3.in' })
      .add(thud)
      .to(S.press, { t: 0, duration: 1.1, ease: 'elastic.out(1, .45)' }, '+=.08');
  };

  /* the card is set down, the stamp presses once; beside the copy that happens on arrival, stacked under it the
     press waits until the desk is on screen */
  gsap.fromTo(cardWrap, { opacity: 0 }, { opacity: 1, duration: .5, ease: 'power2.out' });
  whenVisible(stage, () => press(.55), { rootMargin: '0px 0px -20% 0px' });

  /* press it again: a mouse on press, a finger on tap (so a scroll that starts here never fires it) */
  stage.classList.add('is-pressable');
  stage.addEventListener(isTouch ? 'click' : 'pointerdown', (e) => {
    if (e.button || pressing || !sealEl.classList.contains('is-stamped')) return;
    press(0);
  });
}

/* The rubber stamp that issues the sample's seal. Its stage is placed so the stamp's landing spot sits exactly on the
   card's seal; it arrives from above, presses, and lifts away, leaving the seal printed in its place. Returns a
   function that plays it once, or throws when WebGL isn't available. */
async function howStamp(stage, host, sealEl) {
  const S = await createStamp(stage.querySelector('canvas'), stage, {
    mode: 'straight', fov: 30, camPos: [0, 3.4, 9.4], look: [0, .9, 0], scale: .36,
    rest: { x: -.3, y: -.7, z: .08 }, restY: .62, dropY: .66, shadowY: -.02, softShadow: true, shadowOpacity: .12, pressShadow: .3
  });
  const LAND = [0, -.06, 0];
  const place = () => {
    const land = S.project(...LAND), hr = host.getBoundingClientRect(), sr = sealEl.getBoundingClientRect();
    stage.style.left = `${(sr.left + sr.width / 2 - hr.left - land.x).toFixed(1)}px`;
    stage.style.top = `${(sr.top + sr.height / 2 - hr.top - land.y).toFixed(1)}px`;
  };
  place();
  new ResizeObserver(place).observe(host);
  Object.assign(S.lift, { y: .8, o: 0 });
  return (onImpact) => new Promise((resolve) => {
    place();
    stage.classList.add('is-on');
    S.play(2.8);
    gsap.timeline({ onComplete: () => { stage.classList.remove('is-on'); resolve(); } })
      .to(stage, { opacity: 1, duration: .35, ease: 'power1.out' }, 0)
      .to(S.lift, { y: 0, o: 1, duration: .8, ease: 'power3.out' }, 0)
      .to(S.press, { t: 1, duration: .3, ease: 'power3.in' }, .85)
      .add(onImpact)
      .to(S.press, { t: 0, duration: .5, ease: 'power2.out' }, '+=.12')
      .to(S.lift, { y: .9, o: 0, duration: .55, ease: 'power2.in' }, '-=.15')
      .to(stage, { opacity: 0, duration: .3, ease: 'power1.in' }, '-=.3');
  });
}

/* ── The short version: the film, played only when asked ───────
   Nothing is fetched until someone presses play. The cut is chosen for the screen at that moment (4:5 on phones,
   16:9 elsewhere, both starting on the poster's own frame), the ring turns while the first frames arrive, and then the
   poster gives way to the film with its controls. At the end the poster returns. A phone turned mid-film switches cut
   where it was, unless the film is full screen. Without script, the video stands on its own with its controls. */
function film() {
  const stage = document.querySelector('[data-film]');
  if (!stage) return;
  const video = stage.querySelector('[data-film-video]'), disc = stage.querySelector('[data-film-play]'), poster = stage.querySelector('[data-film-poster]');
  const cuts = [...video.querySelectorAll('source')].map((el) => ({ src: el.src, media: el.media }));
  const pick = () => (cuts.find((c) => !c.media || matchMedia(c.media).matches) || cuts[cuts.length - 1]).src;
  let src = '';
  video.removeAttribute('controls');

  const failed = () => { stage.classList.remove('is-loading'); stage.classList.add('is-playing'); video.setAttribute('controls', ''); };
  const start = () => {
    if (!src) { src = pick(); video.preload = 'auto'; video.src = src; }
    stage.classList.add('is-loading');
    const p = video.play();
    if (p) p.catch((e) => { if (e.name !== 'AbortError') failed(); });
  };
  disc.addEventListener('click', start);
  poster.addEventListener('click', start);

  video.addEventListener('playing', () => {
    const fromDisc = document.activeElement === disc;
    stage.classList.remove('is-loading');
    stage.classList.add('is-playing');
    video.setAttribute('controls', '');
    if (fromDisc) video.focus({ preventScroll: true });
  });
  video.addEventListener('ended', () => {
    const fromVideo = document.activeElement === video;
    if (document.fullscreenElement === video) document.exitFullscreen().catch(() => {});
    else if (video.webkitDisplayingFullscreen && video.webkitExitFullscreen) video.webkitExitFullscreen();
    stage.classList.remove('is-playing');
    video.removeAttribute('controls');
    if (fromVideo) disc.focus({ preventScroll: true });
  });
  video.addEventListener('error', () => { if (src) failed(); });

  matchMedia('(max-width: 767px)').addEventListener('change', () => {
    if (!src || document.fullscreenElement || video.webkitDisplayingFullscreen) return;
    const next = pick();
    if (next === src) return;
    const at = video.currentTime, playing = !video.paused && !video.ended;
    src = next;
    video.src = src;
    video.addEventListener('loadedmetadata', () => { video.currentTime = at; if (playing) video.play().catch(() => {}); }, { once: true });
  });
}

/* ── How it works: one application moving through the three checks, played once ── */
function how() {
  const section = document.querySelector('[data-how]');
  const steps = [...section.querySelectorAll('[data-step]')];
  const status = section.querySelector('[data-how-status]');
  const sealEl = section.querySelector('[data-how-seal]');
  const card = section.querySelector('[data-how-card]'), ink = section.querySelector('[data-how-ink]');
  const stage = section.querySelector('[data-how-press]'), scene3 = steps[2].querySelector('.how__scene');
  const finish = () => {
    steps.forEach((s) => { s.classList.add('is-lit'); s.style.setProperty('--fill', '1'); });
    sealEl.classList.add('is-stamped');
    section.classList.add('is-played');
  };
  if (reduced) { finish(); stage.remove(); return; }
  status.textContent = 'In review'; status.classList.add('is-pending');
  steps.forEach((s) => gsap.set(s, { '--fill': 0 }));

  /* the stamp is readied as the section approaches, and presses once the application reaches the third check and
     that card is on screen (on phones it sits well below the first two) */
  let press = null, reached;
  const ready = new Promise((resolve) => whenVisible(section, () => howStamp(stage, scene3, sealEl).then((p) => (press = p), () => stage.remove()).finally(resolve), { rootMargin: '400px 0px' }));
  const seen3 = new Promise((resolve) => whenVisible(scene3, resolve, { rootMargin: '0px 0px -22% 0px' }));
  const atStep3 = new Promise((resolve) => (reached = resolve));
  const verified = () => { status.textContent = 'Trulinq Verified'; status.classList.remove('is-pending'); section.classList.add('is-played'); };
  /* the moment the rubber meets the card: the seal is printed, a ring of ink spreads, the card takes the weight */
  const impact = () => {
    gsap.fromTo(sealEl, { opacity: 0, scale: 1.12 }, { opacity: 1, scale: 1, duration: .3, ease: 'power2.out', onComplete: () => { sealEl.classList.add('is-stamped'); gsap.set(sealEl, { clearProps: 'opacity,transform' }); } });
    gsap.fromTo(ink, { opacity: .75, scale: 1 }, { opacity: 0, scale: 2.1, duration: .9, ease: 'power2.out' });
    gsap.timeline().to(card, { y: 5, duration: .09, ease: 'power2.out' }).to(card, { y: 0, duration: .8, ease: 'elastic.out(1, .5)' });
    setTimeout(verified, 280);
  };
  Promise.all([ready, seen3, atStep3]).then(() => {
    if (press) press(impact);
    else { stamp(sealEl, { rotate: -8 }); setTimeout(verified, 350); }
  });

  whenVisible(section.querySelector('[data-steps]'), () => {
    const sweep = section.querySelector('[data-sweep]'), match = section.querySelector('[data-match]');
    const rows = [...section.querySelectorAll('[data-row]')];
    const lit = (i) => () => steps[i].classList.add('is-lit');
    const tl = gsap.timeline();
    tl.add(lit(0), 0)
      .fromTo(sweep, { xPercent: -80, opacity: 0 }, { xPercent: 460, opacity: 1, duration: 1.2, ease: 'power2.inOut' }, .2)
      .to(sweep, { opacity: 0, duration: .25 }, 1.2)
      .to(match, { opacity: 1, scale: 1, duration: .5, ease: 'back.out(2)' }, 1.15)
      .to(steps[0], { '--fill': 1, duration: .6, ease: 'power2.inOut' }, 1.5)
      .add(lit(1), 2.05);
    rows.forEach((row, i) => {
      tl.to(row, { opacity: 1, duration: .3 }, 2.1 + i * .22)
        .to(row.querySelector('.tick'), { scale: 1, duration: .4, ease: 'back.out(3)' }, 2.2 + i * .22);
    });
    const t3 = 2.3 + rows.length * .22;
    tl.to(steps[1], { '--fill': 1, duration: .6, ease: 'power2.inOut' }, t3)
      .add(lit(2), t3 + .55)
      .add(reached, t3 + .6);
  }, { rootMargin: '0px 0px -25% 0px' });
}

/* ── Globe: members who list a city, grouped where they work close together ── */
const RAD = Math.PI / 180;
const inHawaii = (m) => m.lat > 18.5 && m.lat < 22.6 && m.lng > -160.6 && m.lng < -154.4;
function groupsOf(list) {
  const groups = [];
  for (const m of list) {
    const key = inHawaii(m) ? 'hawaii' : '';
    let g = key ? groups.find((x) => x.key === key) : groups.find((x) => !x.key && Math.hypot(x.members[0].lat - m.lat, x.members[0].lng - m.lng) < 2);
    if (!g) { g = { key, members: [] }; groups.push(g); }
    g.members.push(m);
  }
  for (const g of groups) {
    g.lat = g.members.reduce((a, m) => a + m.lat, 0) / g.members.length;
    g.lng = g.members.reduce((a, m) => a + m.lng, 0) / g.members.length;
    g.label = g.key === 'hawaii' ? 'Hawaiʻi' : g.members[0].city;
    g.hq = g.members.some((m) => m.id === FEATURED.hero);
  }
  return groups.sort((a, b) => b.hq - a.hq || b.members.length - a.members.length);
}

/* The land, as dots: an even grid on the sphere (src/data/land.js), kept where the grid falls on land. */
function landDots() {
  const bytes = Uint8Array.from(atob(LAND.bits), (c) => c.charCodeAt(0));
  const out = [];
  let i = 0;
  for (let lat = 90 - LAND.step / 2; lat > -90; lat -= LAND.step) {
    const n = Math.max(1, Math.round((360 * Math.cos(lat * RAD)) / LAND.step));
    for (let j = 0; j < n; j++, i++) if (bytes[i >> 3] & (1 << (i & 7))) out.push(Math.sin(lat * RAD), Math.cos(lat * RAD), (-180 + ((j + .5) * 360) / n) * RAD);
  }
  return new Float32Array(out);
}

/* An orthographic globe drawn in 2D: a paper sphere, a faint graticule, the land in blue-ink dots and each group of
   members as monograms where they work. It is drawn once, and again only while someone turns it. */
function globe() {
  const wrap = document.querySelector('[data-globe]');
  const sphere = wrap.querySelector('.world__sphere');
  const canvas = wrap.querySelector('[data-globe-canvas]');
  const pinsEl = wrap.querySelector('[data-globe-pins]');
  const located = members.filter((m) => m.lat != null && m.lng != null);
  if (!located.length) { wrap.hidden = true; return; }
  const groups = groupsOf(located);
  const where = groups.map((g) => `${g.label} (${g.members.length})`).join(', ');
  canvas.setAttribute('aria-label', `A globe showing where verified members work: ${where}.`);
  wrap.querySelector('[data-globe-caption]').textContent = `${located.length} of ${members.length} verified members list a city. Each is pinned where they work.${isTouch ? '' : ' Drag to turn the globe.'}`;
  const ctx = canvas.getContext('2d');
  if (!ctx) { sphere.hidden = true; return; }

  const dots = landDots();
  pinsEl.innerHTML = groups.map((g, i) => {
    const one = g.members.length === 1;
    return `<div class="pin ${g.hq ? 'pin--hq' : ''} ${one ? 'pin--solo' : ''}" data-pin="${i}"><span class="pin__faces">${g.members.slice(0, 5).map((m) => portrait(m, { size: 52 })).join('')}</span><span class="pin__label">${esc(g.label)} <em>${one ? esc(g.members[0].first) : `${g.members.length} members`}</em></span></div>`;
  }).join('');
  const pinEls = [...pinsEl.querySelectorAll('[data-pin]')];
  /* each pin is anchored at the middle of its faces, wherever its label sits */
  let anchors = [], sizes = [];
  const measure = () => {
    anchors = pinEls.map((el) => { const f = el.firstElementChild; return [f.offsetLeft + f.offsetWidth / 2, f.offsetTop + f.offsetHeight / 2]; });
    sizes = pinEls.map((el) => { const f = el.firstElementChild, l = el.lastElementChild; return { fw: f.offsetWidth, fh: f.offsetHeight, lw: l.offsetWidth, lh: l.offsetHeight }; });
    pinEls.forEach((el, i) => (el.style.transformOrigin = `${anchors[i][0]}px ${anchors[i][1]}px`));
  };
  /* A single member's label sits beside their face: to the right, else to the left, else below, whichever covers no
     other pin and stays inside the globe's frame. */
  const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const placeLabels = (spots) => {
    const taken = spots.filter((p) => p.vis).map((p) => ({ x: p.fx - p.s.fw / 2, y: p.fy - p.s.fh / 2, w: p.s.fw, h: p.s.fh, owner: p.i }));
    spots.filter((p) => p.vis && p.g.hq).forEach((p) => taken.push({ x: p.fx - p.s.lw / 2, y: p.fy + p.s.fh / 2 + 6, w: p.s.lw, h: p.s.lh, owner: p.i }));
    spots.filter((p) => p.vis && !p.g.hq).forEach((p) => {
      const y = p.fy - p.s.lh / 2, gap = 8;
      const sides = {
        right: { x: p.fx + p.s.fw / 2 + gap, y, w: p.s.lw, h: p.s.lh },
        left: { x: p.fx - p.s.fw / 2 - gap - p.s.lw, y, w: p.s.lw, h: p.s.lh },
        below: { x: p.fx - p.s.lw / 2, y: p.fy + p.s.fh / 2 + 6, w: p.s.lw, h: p.s.lh }
      };
      const outside = (r) => Math.max(0, -r.x) + Math.max(0, r.x + r.w - W) + Math.max(0, -r.y) + Math.max(0, r.y + r.h - W);
      const cost = (r) => taken.reduce((a, t) => a + (t.owner === p.i ? 0 : overlap(r, t)), 0) + outside(r) * r.h * 4;
      const side = Object.keys(sides).reduce((best, k) => (cost(sides[k]) < cost(sides[best]) - 1 ? k : best), 'right');
      pinEls[p.i].classList.toggle('pin--left', side === 'left');
      pinEls[p.i].classList.toggle('pin--below', side === 'below');
      taken.push({ ...sides[side], owner: p.i });
    });
  };

  /* face the middle of the groups */
  const view = { lng: groups.reduce((a, g) => a + g.lng, 0) / groups.length, lat: Math.max(-40, Math.min(40, groups.reduce((a, g) => a + g.lat, 0) / groups.length - 6)) };
  let W = 0, R = 0, dpr = 1;
  const project = (sinLat, cosLat, lng) => {
    const l0 = view.lng * RAD, p0 = view.lat * RAD, dl = lng - l0, c = Math.cos(dl);
    return [cosLat * Math.sin(dl), Math.cos(p0) * sinLat - Math.sin(p0) * cosLat * c, Math.sin(p0) * sinLat + Math.cos(p0) * cosLat * c];
  };
  const graticule = [];
  for (let lng = -180; lng < 180; lng += 30) { const line = []; for (let lat = -90; lat <= 90; lat += 3) line.push([lat, lng]); graticule.push(line); }
  for (let lat = -60; lat <= 60; lat += 30) { const line = []; for (let lng = -180; lng <= 180; lng += 3) line.push([lat, lng]); graticule.push(line); }

  /* by day a paper sphere with the land in blue ink; at night a deep blue sphere, lit from the upper left, the land in
     brighter blue so it still reads */
  const PALETTE = {
    light: { shade: ['#FFFFFF', '#F7FAFF', '#E7EFFC'], grid: 'rgba(41, 129, 251, .16)', land: '23, 102, 230', alpha: [.36, .56, .78, .95], rim: 'rgba(10, 22, 51, .08)' },
    dark: { shade: ['#1A2C50', '#101E39', '#0A1529'], grid: 'rgba(122, 184, 255, .12)', land: '92, 160, 255', alpha: [.3, .5, .72, .92], rim: 'rgba(232, 238, 247, .1)' }
  };
  function draw() {
    const cx = W / 2, cy = W / 2, P = PALETTE[theme()];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);
    /* the sphere */
    const shade = ctx.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R);
    shade.addColorStop(0, P.shade[0]); shade.addColorStop(.7, P.shade[1]); shade.addColorStop(1, P.shade[2]);
    ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    /* the graticule, front side only */
    ctx.strokeStyle = P.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const line of graticule) {
      let pen = false;
      for (const [lat, lng] of line) {
        const [x, y, z] = project(Math.sin(lat * RAD), Math.cos(lat * RAD), lng * RAD);
        if (z < 0) { pen = false; continue; }
        const px = cx + x * R, py = cy - y * R;
        if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
      }
    }
    ctx.stroke();
    /* the land, in four shades of ink by how directly it faces us */
    const base = R * .0068, buckets = [[], [], [], []];
    for (let k = 0; k < dots.length; k += 3) {
      const [x, y, z] = project(dots[k], dots[k + 1], dots[k + 2]);
      if (z <= .02) continue;
      buckets[Math.min(3, Math.floor(z * 4))].push(cx + x * R, cy - y * R, base * (.55 + .45 * z));
    }
    buckets.forEach((b, i) => {
      ctx.fillStyle = `rgba(${P.land}, ${P.alpha[i]})`;
      ctx.beginPath();
      for (let k = 0; k < b.length; k += 3) { ctx.moveTo(b[k] + b[k + 2], b[k + 1]); ctx.arc(b[k], b[k + 1], b[k + 2], 0, Math.PI * 2); }
      ctx.fill();
    });
    /* the rim */
    ctx.strokeStyle = P.rim; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R - .5, 0, Math.PI * 2); ctx.stroke();
    /* the members */
    const spots = groups.map((g, i) => {
      const [x, y, z] = project(Math.sin(g.lat * RAD), Math.cos(g.lat * RAD), g.lng * RAD);
      const el = pinEls[i], vis = z > .15, [ax, ay] = anchors[i];
      const fx = cx + x * R, fy = cy - y * R;
      el.style.transform = `translate(${(fx - ax).toFixed(1)}px, ${(fy - ay).toFixed(1)}px) scale(${vis ? (.86 + z * .14).toFixed(3) : .6})`;
      el.style.opacity = vis ? Math.min(1, (z - .15) * 5).toFixed(2) : 0;
      el.style.zIndex = Math.round(z * 100);
      return { g, i, fx, fy, vis, s: sizes[i] };
    });
    placeLabels(spots);
  }
  const resize = () => {
    W = sphere.clientWidth; R = W * (W < 480 ? .49 : .44); dpr = Math.min(window.devicePixelRatio || 1, 2); measure();
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(W * dpr);
    draw();
  };
  resize(); new ResizeObserver(resize).observe(sphere);
  window.addEventListener('themechange', draw);

  /* drag to turn; it redraws only while it moves */
  let raf = null, velocity = 0, dragging = false, lastX = 0;
  const tick = () => {
    raf = null;
    if (!dragging) { view.lng -= velocity; velocity *= .92; }
    draw();
    if (dragging || Math.abs(velocity) > .01) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; velocity = 0; canvas.classList.add('is-dragging'); canvas.setPointerCapture?.(e.pointerId); kick(); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; const deg = (dx / R) / RAD; view.lng -= deg; velocity = reduced ? 0 : deg * .9; });
  const up = () => { if (!dragging) return; dragging = false; canvas.classList.remove('is-dragging'); kick(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
}

/* the wash and the film need no data, so they start with the page */
heroWash();
film();
boot(build, () => {
  hero();
  how();
  app();
  /* touch screens have no hover: each feature card plays its scene once, as it comes into view */
  if (isTouch) document.querySelectorAll('.bento__card').forEach((card) => whenVisible(card, () => card.classList.add('is-live'), { rootMargin: '0px 0px -30% 0px' }));
  whenVisible(document.querySelector('[data-globe]'), globe, { rootMargin: '400px 0px' });
});
