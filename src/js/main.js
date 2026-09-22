/* Trulinq shared engine: smooth scroll, curtain transitions, nav, reveals, stamps, accordions, forms. */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import { sealSVG } from './ui.js';

gsap.registerPlugin(ScrollTrigger, SplitText);

const html = document.documentElement;
html.classList.remove('no-js');
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('nomotion');
export const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
if (reduced) html.classList.add('reduced-motion');

gsap.defaults({ ease: 'expo.out', duration: 1 });
window.__gsap = gsap; // exposed for QA tooling: lets automated checks drive the ticker when a tab is hidden
ScrollTrigger.config({ ignoreMobileResize: true });

/* ── Smooth scroll ─────────────────────────────────────────────── */
export let lenis = null;
if (!reduced && !isTouch) {
  lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), lerp: 0.1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
let programmaticScroll = 0;
const NAV_OFFSET = 90;
/* Smooth-scroll to a number, selector or element. Targets resolve to an absolute position first so the landing
   spot never depends on the smooth-scroller's internal state. Programmatic scrolls never hide the nav. */
export function scrollTo(target, opts = {}) {
  let top = 0;
  if (typeof target === 'number') top = target;
  else {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    top = el.getBoundingClientRect().top + window.scrollY - (opts.offset === undefined ? NAV_OFFSET : -opts.offset);
  }
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  top = Math.min(Math.max(0, top), max);
  clearTimeout(programmaticScroll); programmaticScroll = setTimeout(() => (programmaticScroll = 0), 1800);
  const done = () => { clearTimeout(programmaticScroll); programmaticScroll = 0; opts.onComplete && opts.onComplete(); };
  if (lenis) lenis.scrollTo(top, { duration: opts.duration || 1.4, onComplete: done });
  else { window.scrollTo({ top, behavior: reduced ? 'auto' : 'smooth' }); setTimeout(done, reduced ? 0 : 900); }
}

/* ── Curtain: first load + between pages ───────────────────────── */
const curtain = document.querySelector('.curtain');
const fromTransition = sessionStorage.getItem('tq-transition') === '1';
sessionStorage.removeItem('tq-transition');
sessionStorage.removeItem('tq-to');

export function revealPage(onLift) {
  return new Promise((resolve) => {
    const lift = () => { try { onLift && onLift(); } catch (err) { console.error(err); } };
    if (!curtain) { lift(); return resolve(); }
    if (reduced) { curtain.style.display = 'none'; html.classList.add('is-ready'); sessionStorage.setItem('tq-visited', '1'); lift(); return resolve(); }
    const check = curtain.querySelector('.curtain__check');
    const sealEl = curtain.querySelector('.curtain__seal');
    const label = curtain.querySelector('[data-curtain-label]');
    const tl = gsap.timeline({ onComplete: () => { curtain.style.display = 'none'; curtain.classList.remove('is-transition'); html.classList.add('is-ready'); resolve(); } });
    const revisit = !fromTransition && sessionStorage.getItem('tq-visited') === '1';
    sessionStorage.setItem('tq-visited', '1');
    if (revisit) {
      /* Back, forward or a typed URL within the session: a quick lift, no preloader */
      tl.set(sealEl, { opacity: 0 })
        .add(lift, .05)
        .to(curtain, { yPercent: -100, borderRadius: '0 0 40px 40px', duration: .9, ease: 'expo.inOut' }, .05);
    } else if (fromTransition && curtain.classList.contains('is-transition')) {
      /* The label was already on screen before the reload; hold it a beat, send it up, and lift the panel behind it. */
      tl.to(label, { yPercent: -110, duration: .55, ease: 'expo.in' }, .18)
        .add(lift, .42)
        .to(curtain, { yPercent: -100, borderRadius: '0 0 40px 40px', duration: 1, ease: 'expo.inOut' }, .42)
        .from('main', { scale: 1.015, duration: 1.2, ease: 'expo.out', clearProps: 'transform' }, .5);
    } else {
      tl.fromTo(sealEl, { scale: .6, opacity: 0, rotate: -30 }, { scale: 1, opacity: 1, rotate: 0, duration: .8, ease: 'back.out(1.7)' })
        .to(check, { strokeDashoffset: 0, duration: .5, ease: 'power2.inOut' }, '-=.35')
        .to(sealEl, { scale: .92, duration: .25, ease: 'power2.in' }, '+=.15')
        .to(sealEl, { scale: 1.06, opacity: 0, duration: .35, ease: 'power2.out' })
        .add(lift, '-=.25')
        .to(curtain, { yPercent: -100, duration: 1, ease: 'expo.inOut', borderRadius: '0 0 48px 48px' }, '-=.3');
    }
  });
}

/* Destination name shown on the panel during a transition */
const SECTION_LABELS = { '': 'Trulinq', directory: 'Directory', match: 'Match', rooms: 'Rooms', feed: 'Feed', pricing: 'Pricing', trust: 'Trust Centre', contact: 'Contact', privacy: 'Privacy', terms: 'Terms', verify: 'Get verified', auth: 'Sign in', dashboard: 'Dashboard', members: 'Member' };
function cleanText(el) { const c = el.cloneNode(true); c.querySelectorAll('svg, .seal, .btn__icon, em, time, small').forEach((n) => n.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); }
function labelFor(a, url) {
  if (a.dataset.label) return a.dataset.label;
  const base = import.meta.env.BASE_URL || '/';
  const rel = url.pathname.startsWith(base) ? url.pathname.slice(base.length) : url.pathname.replace(/^\//, '');
  const seg = rel.split('/').filter(Boolean)[0] || '';
  if (seg === 'members') {
    const name = a.querySelector('.idcard__name, .mcard__name, b') || (a.matches('.fit__person, .msg__who, .post__who') ? a : null);
    const t = name ? cleanText(name) : '';
    return t && t.length <= 32 ? t : 'Member';
  }
  if (seg === 'auth') return url.searchParams.get('mode') === 'signup' ? 'Create account' : 'Sign in';
  return SECTION_LABELS[seg] || 'Trulinq';
}

/* Prefetch the next document as soon as intent shows, so the swap behind the panel is instant */
const prefetched = new Set();
function prefetch(a) {
  if (!isInternal(a)) return;
  const url = new URL(a.href, location.href); const key = url.pathname;
  if (prefetched.has(key) || url.pathname === location.pathname) return;
  prefetched.add(key);
  const l = document.createElement('link'); l.rel = 'prefetch'; l.href = url.pathname + url.search; l.as = 'document'; document.head.appendChild(l);
}
document.addEventListener('pointerenter', (e) => { const a = e.target && e.target.closest && e.target.closest('a[href]'); if (a) prefetch(a); }, true);
document.addEventListener('touchstart', (e) => { const a = e.target && e.target.closest && e.target.closest('a[href]'); if (a) prefetch(a); }, { passive: true, capture: true });

function isInternal(a) {
  if (!a || a.target === '_blank' || a.hasAttribute('download') || a.dataset.noTransition !== undefined) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (url.pathname === location.pathname && url.hash) return false;
  if (url.protocol === 'mailto:' || url.protocol === 'tel:') return false;
  return true;
}
let leaving = false;
/* Leave the page behind the rising panel, carrying the destination's name. Used by link clicks and programmatic navigation. */
export function go(target, text = 'Trulinq') {
  const url = new URL(target, location.href);
  if (reduced || !curtain) { location.href = url.href; return; }
  if (leaving) return;
  leaving = true;
  closeMenu();
  const label = curtain.querySelector('[data-curtain-label]');
  label.textContent = text;
  curtain.classList.add('is-transition');
  curtain.style.display = 'grid';
  const main = document.querySelector('main');
  main && main.classList.add('is-leaving');
  gsap.set(curtain, { yPercent: 100, borderRadius: '40px 40px 0 0' });
  gsap.set(label, { yPercent: 110 });
  gsap.timeline()
    .to(main, { scale: .985, opacity: .55, duration: .8, ease: 'expo.inOut' }, 0)
    .to(curtain, { yPercent: 0, borderRadius: '0 0 0 0', duration: .8, ease: 'expo.inOut' }, 0)
    .to(label, { yPercent: 0, duration: .6, ease: 'expo.out' }, .42)
    .add(() => { sessionStorage.setItem('tq-transition', '1'); sessionStorage.setItem('tq-to', text); location.href = url.href; }, .98);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
  const url = new URL(a.href, location.href);
  /* Same-page anchors: smooth scroll with the nav offset; never a page transition */
  if (url.origin === location.origin && url.pathname === location.pathname && url.hash && !a.hasAttribute('download')) {
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target) return;
    e.preventDefault();
    history.pushState(null, '', url.hash);
    scrollTo(target);
    return;
  }
  if (!isInternal(a)) return;
  if (url.pathname === location.pathname && !url.search) { e.preventDefault(); scrollTo(0); return; }
  if (reduced || !curtain) return;
  e.preventDefault();
  go(url.href, labelFor(a, url));
});
window.addEventListener('pageshow', (e) => { if (e.persisted && curtain) { curtain.style.display = 'none'; leaving = false; const main = document.querySelector('main'); if (main) { main.classList.remove('is-leaving'); gsap.set(main, { clearProps: 'transform,opacity' }); } } });

/* ── Nav behaviour ─────────────────────────────────────────────── */
const nav = document.querySelector('[data-nav]');
const burger = document.querySelector('[data-burger]');
const menu = document.querySelector('[data-menu]');
let menuOpen = false;

/* Hide on a deliberate scroll down, show on a deliberate scroll up. Direction-locked with hysteresis, so
   smooth-scroll tails, trackpad jitter and iOS overscroll never flip the state. */
const navState = { lastY: Math.max(0, window.scrollY), anchorY: Math.max(0, window.scrollY), dir: 0 };
const HIDE_AFTER = 200, TRAVEL_TO_HIDE = 90, TRAVEL_TO_SHOW = 40, SHOW_BELOW = 120;
function updateNav() {
  if (!nav) return;
  const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  const y = Math.min(Math.max(0, window.scrollY), maxY);
  const delta = y - navState.lastY;
  if (y > 32) nav.classList.add('is-scrolled'); else if (y < 8) nav.classList.remove('is-scrolled');
  if (Math.abs(delta) < 1) return;
  const dir = delta > 0 ? 1 : -1;
  if (dir !== navState.dir) { navState.dir = dir; navState.anchorY = navState.lastY; }
  navState.lastY = y;
  const travelled = Math.abs(y - navState.anchorY);
  if (menuOpen || leaving || programmaticScroll) { nav.classList.remove('is-hidden'); return; }
  if (y < SHOW_BELOW) { nav.classList.remove('is-hidden'); return; }
  if (dir === 1 && y > HIDE_AFTER && travelled >= TRAVEL_TO_HIDE) nav.classList.add('is-hidden');
  else if (dir === -1 && travelled >= TRAVEL_TO_SHOW) nav.classList.remove('is-hidden');
}
window.addEventListener('scroll', updateNav, { passive: true });
window.addEventListener('resize', () => { navState.lastY = Math.max(0, window.scrollY); navState.anchorY = navState.lastY; }, { passive: true });
/* Keyboard users tabbing into a hidden nav get it back */
nav && nav.addEventListener('focusin', () => { nav.classList.remove('is-hidden'); navState.anchorY = navState.lastY; });
updateNav();

/* Dark-panel awareness: tint the pill when it floats over an ink panel */
export function watchNavTone() {
  const inks = document.querySelectorAll('.panel--ink, .panel--orange, .panel--violet, [data-nav-tone="ink"]');
  inks.forEach((el) => {
    ScrollTrigger.create({
      trigger: el, start: 'top 48px', end: 'bottom 48px',
      onToggle: (self) => nav && nav.classList.toggle('nav--ink', self.isActive)
    });
  });
}

document.querySelectorAll('[data-nav-link]').forEach((a) => {
  const p = new URL(a.href).pathname;
  const base = (import.meta.env.BASE_URL || '/');
  if (location.pathname === p || (p !== base && location.pathname.startsWith(p))) { a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); }
});

function openMenu() {
  if (!menu) return;
  menuOpen = true;
  menu.classList.add('is-open'); menu.setAttribute('aria-hidden', 'false');
  burger.setAttribute('aria-expanded', 'true'); burger.setAttribute('aria-label', 'Close menu');
  document.body.classList.add('is-locked'); lenis && lenis.stop();
  nav.classList.remove('is-hidden');
  navState.anchorY = navState.lastY;
  const links = menu.querySelectorAll('.menu__links a, .menu__foot .btn');
  if (reduced) { gsap.set(menu, { clipPath: 'inset(0 0 0% 0 round 0 0 0px 0px)' }); gsap.set(links, { clearProps: 'all' }); return; }
  gsap.timeline()
    .to(menu, { clipPath: 'inset(0 0 0% 0 round 0 0 0px 0px)', duration: .8, ease: 'expo.inOut' })
    .fromTo(links, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .06 }, '-=.35');
}
export function closeMenu() {
  if (!menu || !menuOpen) return;
  menuOpen = false;
  burger.setAttribute('aria-expanded', 'false'); burger.setAttribute('aria-label', 'Open menu');
  document.body.classList.remove('is-locked'); lenis && lenis.start();
  const done = () => { menu.classList.remove('is-open'); menu.setAttribute('aria-hidden', 'true'); };
  if (reduced) { gsap.set(menu, { clipPath: 'inset(0 0 100% 0 round 0 0 40px 40px)' }); done(); return; }
  gsap.to(menu, { clipPath: 'inset(0 0 100% 0 round 0 0 40px 40px)', duration: .7, ease: 'expo.inOut', onComplete: done });
}
burger && burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

/* ── Reveal choreography ───────────────────────────────────────── */
/* CSS hover transitions on transform fight GSAP mid-tween; suspend them while GSAP owns the element. */
export function suspend(targets) { gsap.set(targets, { transition: 'none' }); }
export function restore(targets) { gsap.set(targets, { clearProps: 'transition' }); }
export function popIn(targets, vars = {}, trigger = null) {
  const els = gsap.utils.toArray(targets);
  if (!els.length) return;
  if (reduced) { gsap.set(els, { clearProps: 'all' }); return; }
  suspend(els);
  return gsap.from(els, { scale: .5, opacity: 0, rotation: () => gsap.utils.random(-7, 7), duration: 1.2, ease: 'elastic.out(1, .7)', stagger: { each: .045, from: 'random' },
    ...vars, scrollTrigger: trigger ? { trigger, start: 'top 88%', once: true } : undefined,
    onComplete: () => gsap.set(els, { clearProps: 'transform,opacity,transition' }) });
}

export function splitLines(el) {
  return new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'split-line-inner' });
}

/* A section with data-gate holds every reveal inside it until one moment: its own trigger (data-gate-trigger, a
   selector, default the section) reaches the given start (data-gate, default "top 60%"). Used where a section must
   read as one event, like the score gauge. */
export function gateFor(el, fallback) {
  const gate = el.closest('[data-gate]');
  if (!gate) return fallback;
  const trig = gate.dataset.gateTrigger ? gate.querySelector(gate.dataset.gateTrigger) || gate : gate;
  return { trigger: trig, start: gate.dataset.gate || 'top 60%', once: true };
}

export function initReveals(scope = document) {
  if (reduced) { scope.querySelectorAll('[data-reveal],[data-split]').forEach((el) => (el.style.opacity = 1)); return; }

  scope.querySelectorAll('[data-split]').forEach((el) => {
    const delay = parseFloat(el.dataset.delay || 0);
    let played = false;
    /* autoSplit re-splits when the width changes (a phone rotating, a window resizing), so a line never wraps inside
       its mask; once the reveal has played the fresh lines simply sit at rest */
    SplitText.create(el, {
      type: 'lines', mask: 'lines', linesClass: 'split-line-inner', autoSplit: true,
      onSplit(self) {
        el.style.opacity = 1;
        if (played) return;
        return gsap.from(self.lines, { yPercent: 110, duration: 1.15, ease: 'expo.out', stagger: 0.07, delay, scrollTrigger: gateFor(el, { trigger: el, start: 'top 88%', once: true }), onComplete: () => { played = true; } });
      }
    });
  });

  scope.querySelectorAll('[data-reveal]').forEach((el) => {
    const kind = el.dataset.reveal || 'up';
    const delay = parseFloat(el.dataset.delay || 0);
    /* entrances settle from a soft blur (pointer devices only: a phone GPU should not repaint filters) */
    const soft = isTouch ? {} : { filter: 'blur(10px)' }, sharp = isTouch ? {} : { filter: 'blur(0px)' };
    const from = { up: { y: 28, opacity: 0, ...soft }, fade: { opacity: 0, ...soft }, scale: { scale: .94, opacity: 0, ...soft }, left: { x: -32, opacity: 0 }, right: { x: 32, opacity: 0 }, stamp: { scale: 1.6, rotate: -14, opacity: 0 } }[kind] || { y: 28, opacity: 0, ...soft };
    const to = kind === 'stamp' ? { scale: 1, rotate: 0, opacity: 1, duration: .6, ease: 'back.out(2.2)' } : { x: 0, y: 0, scale: 1, opacity: 1, ...sharp, duration: 1.25, ease: 'expo.out' };
    suspend(el);
    gsap.fromTo(el, from, { ...to, delay, scrollTrigger: gateFor(el, { trigger: el, start: 'top 88%', once: true }), onComplete: () => gsap.set(el, { clearProps: 'transform,transition,filter' }) });
  });

  scope.querySelectorAll('[data-reveal-group]').forEach((group) => {
    const items = group.querySelectorAll(':scope > *');
    const stagger = parseFloat(group.dataset.stagger || 0.08);
    suspend(items);
    const soft = isTouch ? {} : { filter: 'blur(8px)' }, sharp = isTouch ? {} : { filter: 'blur(0px)' };
    gsap.fromTo(items, { y: 32, opacity: 0, ...soft }, { y: 0, opacity: 1, ...sharp, duration: 1.25, ease: 'expo.out', stagger: Math.min(stagger, 0.8 / items.length), scrollTrigger: gateFor(group, { trigger: group, start: 'top 85%', once: true }), onComplete: () => gsap.set(items, { clearProps: 'transform,transition,filter' }) });
  });
}

/* Every panel settles into place as it enters: a touch smaller and softer at the bottom of the screen, full size
   and full presence by the time it reaches the middle. Scroll-linked, so it never lags the hand. The hero (it opens
   the page) and pinned sections (their spacing must stay untouched) are left alone. */
export function initPanels() {
  if (reduced) return;
  document.querySelectorAll('.page > .panel:not(.hero):not([data-pin]):not([data-how]), .footer.panel').forEach((panel) => {
    gsap.fromTo(panel, { scale: .975, opacity: .55 }, { scale: 1, opacity: 1, ease: 'none', transformOrigin: '50% 100%', scrollTrigger: { trigger: panel, start: 'top 98%', end: 'top 55%', scrub: .5 } });
  });
}

/* A soft light follows the pointer across cards (pointer devices only) */
export function initSpotlight(scope = document) {
  if (isTouch || reduced) return;
  scope.querySelectorAll('.card:not(form), .quote, .doubt__pillar, .how__step, .plan, .fit, .mcard, .idcard, .bento__card').forEach((el) => {
    el.classList.add('has-spot');
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${((e.clientX - r.left) / r.width * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${((e.clientY - r.top) / r.height * 100).toFixed(1)}%`);
    }, { passive: true });
  });
}

/* Seal slam: the TruLinq motion signature */
export function stamp(el, { delay = 0, rotate = -6 } = {}) {
  if (!el || el.classList.contains('is-stamped')) return;
  if (reduced) { el.classList.add('is-stamped'); return; }
  const tl = gsap.timeline({ delay, onComplete: () => el.classList.add('is-stamped') });
  tl.fromTo(el, { opacity: 0, scale: 1.9, rotate: rotate - 14 }, { opacity: 1, scale: .96, rotate, duration: .42, ease: 'power4.in' })
    .to(el, { scale: 1, duration: .5, ease: 'elastic.out(1, .45)' })
    .fromTo(el, { '--ring': 0 }, { '--ring': 1, duration: .001 }, 0);
  if (el.parentElement && !el.dataset.quiet) {
    const ripple = document.createElement('i');
    ripple.className = 'stamp-ripple';
    ripple.style.cssText = `position:absolute;inset:-6%;border-radius:50%;border:2px solid ${getComputedStyle(el).getPropertyValue('--seal-bg') || '#2981FB'};pointer-events:none;opacity:0`;
    el.appendChild(ripple);
    tl.fromTo(ripple, { scale: .7, opacity: .8 }, { scale: 1.9, opacity: 0, duration: .9, ease: 'power2.out', onComplete: () => ripple.remove() }, .42);
  }
  return tl;
}
export function initStamps(scope = document) {
  scope.querySelectorAll('.seal[data-stamp]:not(.is-stamped):not(.is-static):not([data-manual])').forEach((el) => {
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => stamp(el, { delay: parseFloat(el.dataset.delay || 0) }) });
  });
}

/* Counters, bars, notes, parallax */
export function initCounters(scope = document) {
  scope.querySelectorAll('[data-counter]').forEach((el) => {
    const to = parseFloat(el.dataset.counter);
    const decimals = (el.dataset.decimals | 0);
    const fmt = (v) => (el.dataset.format === 'plain' ? v.toFixed(decimals) : v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
    if (reduced) { el.textContent = fmt(to); return; }
    const obj = { v: 0 };
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: () => gsap.to(obj, { v: to, duration: 1.8, ease: 'expo.out', onUpdate: () => (el.textContent = fmt(obj.v)) }) });
  });
  scope.querySelectorAll('[data-bar]').forEach((bar) => {
    if (reduced) return;
    gsap.from(bar, { scaleX: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: bar, start: 'top 92%', once: true } });
  });
  scope.querySelectorAll('.note').forEach((n) => {
    ScrollTrigger.create({ trigger: n, start: 'top 92%', once: true, onEnter: () => gsap.fromTo(n, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .8, delay: parseFloat(n.dataset.delay || .2) }) });
    if (!reduced) gsap.set(n, { opacity: 0 });
  });
  if (!reduced) scope.querySelectorAll('[data-parallax]').forEach((el) => {
    const amt = parseFloat(el.dataset.parallax || 0.15) * 100;
    gsap.fromTo(el, { yPercent: -amt }, { yPercent: amt, ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: 0.6 } });
  });
}

/* Accordions */
export function initAccordions(scope = document) {
  scope.querySelectorAll('.acc').forEach((acc) => {
    const single = acc.dataset.single !== undefined;
    acc.querySelectorAll('.acc__btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.acc__item');
        const open = item.classList.contains('is-open');
        if (single) acc.querySelectorAll('.acc__item.is-open').forEach((o) => { o.classList.remove('is-open'); o.querySelector('.acc__btn').setAttribute('aria-expanded', 'false'); });
        item.classList.toggle('is-open', !open);
        btn.setAttribute('aria-expanded', String(!open));
        setTimeout(() => ScrollTrigger.refresh(), 650);
      });
    });
  });
}

/* Marquee: duplicate track content once for a seamless loop */
export function initMarquees(scope = document) {
  scope.querySelectorAll('.marquee__track[data-marquee]').forEach((track) => {
    if (track.dataset.cloned) return;
    track.innerHTML += track.innerHTML;
    track.dataset.cloned = '1';
  });
}

/* Magnetic hover for primary buttons (desktop only) */
export function initMagnetic(scope = document) {
  if (isTouch || reduced) return;
  scope.querySelectorAll('[data-magnetic]').forEach((el) => {
    const strength = parseFloat(el.dataset.magnetic || .3);
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * strength;
      const y = (e.clientY - r.top - r.height / 2) * strength;
      gsap.to(el, { x, y, duration: .6, ease: 'power3.out' });
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: .9, ease: 'elastic.out(1, .4)' }));
  });
}

/* Toast */
let toastEl, toastTimer;
export function toast(msg, { ms = 3600 } = {}) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast'; toastEl.setAttribute('role', 'status');
    toastEl.innerHTML = `<span class="seal seal--sm is-static" data-quiet></span><span data-msg></span>`;
    toastEl.querySelector('.seal').innerHTML = sealSVG();
    document.body.appendChild(toastEl);
  }
  toastEl.querySelector('[data-msg]').textContent = msg;
  requestAnimationFrame(() => toastEl.classList.add('is-in'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-in'), ms);
}

/* Newsletter (footer) */
document.querySelectorAll('[data-newsletter]').forEach((form) => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = form.querySelector('input[type=email]');
    const msg = form.querySelector('.footer__form-msg');
    if (!input.validity.valid || !input.value) { msg.textContent = 'Enter a working email so the dispatch can reach you.'; msg.style.color = 'var(--danger)'; input.focus(); return; }
    msg.style.color = ''; msg.textContent = 'You are on the list. The next dispatch lands early next month.';
    form.querySelector('button').disabled = true; input.value = '';
    toast('Subscribed to the verified dispatch.');
  });
});

/* Image fade-in */
export function initImages(scope = document) {
  scope.querySelectorAll('img[data-fade]').forEach((img) => {
    const done = () => img.classList.add('is-loaded');
    if (img.complete) done(); else img.addEventListener('load', done, { once: true });
  });
}

/* Fill empty .seal shells with the seal artwork */
export function hydrateSeals(scope = document) {
  scope.querySelectorAll('.seal:empty').forEach((el) => (el.innerHTML = sealSVG()));
  return Promise.resolve();
}

/* Init a page: build DOM first (pageInit), then run reveals + hero choreography as the curtain lifts. */
export async function boot(pageInit, heroInit) {
  await document.fonts.ready;
  initMarquees();
  const ctx = { gsap, ScrollTrigger, SplitText, lenis, reduced, isTouch };
  if (typeof pageInit === 'function') await pageInit(ctx);
  await hydrateSeals();
  ScrollTrigger.refresh();
  await revealPage(() => {
    initReveals(); initStamps(); initCounters(); initAccordions(); initMagnetic(); initImages(); initSpotlight(); watchNavTone();
    if (typeof heroInit === 'function') heroInit(ctx);
    initPanels();
    /* Pins are created by the page after the generic reveals. Sorting puts them first in the refresh order, so every
       trigger below a pinned section is measured with the pin spacing in place (otherwise it fires a viewport or
       more too early). Pins carry refreshPriority: 1. */
    ScrollTrigger.sort(); ScrollTrigger.refresh();
  });
  ScrollTrigger.sort(); ScrollTrigger.refresh();
}

export { gsap, ScrollTrigger, SplitText };
