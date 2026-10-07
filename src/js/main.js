/* The Trulinq engine: navigation, the menu, stamps, accordions, forms, toasts and the page boot.
   Scrolling belongs to the browser: nothing is pinned, smoothed, hijacked or tied to the scroll position. Motion is
   reserved for moments that mean something (a stamp being issued, a score being read, a state changing). */
import gsap from 'gsap';
import { sealSVG, href, portrait, esc, isVerified } from './ui.js';
import { api } from './api.js';
import { loadSession, loadMembers } from './data.js';
import { FEATURED } from '../data/editorial.js';

const html = document.documentElement;
html.classList.remove('no-js');
html.classList.add('js');
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('nomotion');
export const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
if (reduced) html.classList.add('reduced-motion');

gsap.defaults({ ease: 'expo.out', duration: .6 });
window.__gsap = gsap; // lets automated checks drive the ticker when a tab is hidden

/* ── The intro ─────────────────────────────────────────────────── */
/* The loader is the one on trulinqid.com, played the same way: a navy panel with a soft pulsing glow, the mark fading
   in from three quarters size, "Welcome to" and "Trulinq." rising after it, and at 2.4s the whole panel fading out over
   0.7s. partials/head.html decides before the first paint whether it plays (html.has-intro: once per browser tab) and
   the timing lives entirely in CSS from that first frame. This only follows it: the page counts as revealed when the
   fade begins, and the panel leaves the document when the fade ends. Everything that plays "the first time it is seen"
   waits for `introDone`, so nothing happens behind the panel. */
const introEl = document.querySelector('[data-intro]');
let introResolve, revealResolve;
export const introDone = new Promise((resolve) => (introResolve = resolve));
/* the moment the page itself starts to show: as the loader begins to fade, or at once when there is none */
export const pageRevealed = new Promise((resolve) => (revealResolve = resolve));
const INTRO_LEAVE_AT = 2400, INTRO_LEAVE_FOR = 700;

function introFinish() {
  html.classList.remove('has-intro');
  if (introEl) introEl.remove();
  revealResolve();
  introResolve();
}
function runIntro() {
  if (!introEl || !html.classList.contains('has-intro')) { introFinish(); return; }
  const leave = introEl.getAnimations ? introEl.getAnimations().find((a) => a.animationName === 'intro-leave') : null;
  const elapsed = leave && leave.currentTime != null ? leave.currentTime : 0;
  setTimeout(() => { introEl.style.pointerEvents = 'none'; revealResolve(); }, Math.max(0, INTRO_LEAVE_AT - elapsed));
  const gone = leave ? leave.finished : new Promise((resolve) => setTimeout(resolve, INTRO_LEAVE_AT + INTRO_LEAVE_FOR - elapsed));
  gone.then(introFinish, introFinish);
}
runIntro();

/* ── Visibility ────────────────────────────────────────────────── */
/* Run a callback once, the first time an element comes on screen (after the intro, if one is playing). */
export function whenVisible(el, cb, { rootMargin = '0px 0px -12% 0px', threshold = 0 } = {}) {
  if (!el) return () => {};
  let io = null, cancelled = false;
  introDone.then(() => {
    if (cancelled) return;
    if (!('IntersectionObserver' in window)) { cb(); return; }
    io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); cb(); } }, { rootMargin, threshold });
    io.observe(el);
  });
  return () => { cancelled = true; if (io) io.disconnect(); };
}
/* Report every entry and exit, for canvases that should only render while they can be seen. */
export function whileVisible(el, on) {
  if (!el || !('IntersectionObserver' in window)) { on(true); return () => {}; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => on(e.isIntersecting)), { rootMargin: '120px 0px' });
  io.observe(el);
  return () => io.disconnect();
}

/* ── Navigation ───────────────────────────────────────────────── */
export function go(url) { location.assign(url); }
export function scrollTo(target) {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (el) el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

/* Prefetch the next document when intent shows, so navigation feels instant. */
const prefetched = new Set();
function prefetch(a) {
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin || url.pathname === location.pathname || prefetched.has(url.pathname)) return;
  prefetched.add(url.pathname);
  const l = document.createElement('link'); l.rel = 'prefetch'; l.href = url.pathname + url.search; document.head.appendChild(l);
}
document.addEventListener('pointerenter', (e) => { const a = e.target && e.target.closest && e.target.closest('a[href]'); if (a) prefetch(a); }, true);
document.addEventListener('touchstart', (e) => { const a = e.target && e.target.closest && e.target.closest('a[href]'); if (a) prefetch(a); }, { passive: true, capture: true });

document.querySelectorAll('[data-nav-link]').forEach((a) => {
  const p = new URL(a.href).pathname;
  if (location.pathname === p || (p !== BASE_PATH() && location.pathname.startsWith(p))) { a.classList.add('is-active'); a.setAttribute('aria-current', 'page'); }
});
function BASE_PATH() { return import.meta.env.BASE_URL || '/'; }

/* ── The menu: a modal dialog on small screens ─────────────────── */
const menu = document.querySelector('[data-menu]');
const burger = document.querySelector('[data-burger]');
let menuOpen = false;
const focusables = () => [...menu.querySelectorAll('a[href], button:not([disabled])')];
function trap(e) {
  if (e.key === 'Escape') { closeMenu(); return; }
  if (e.key !== 'Tab') return;
  const f = focusables(), first = f[0], last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}
function openMenu() {
  if (!menu || menuOpen) return;
  menuOpen = true;
  menu.hidden = false;
  burger.setAttribute('aria-expanded', 'true');
  document.body.classList.add('is-locked');
  if (reduced) menu.classList.add('is-open'); else requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
  menu.addEventListener('keydown', trap);
  setTimeout(() => (focusables()[1] || focusables()[0]).focus({ preventScroll: true }), reduced ? 0 : 60);
}
export function closeMenu() {
  if (!menu || !menuOpen) return;
  menuOpen = false;
  menu.classList.remove('is-open');
  burger.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('is-locked');
  menu.removeEventListener('keydown', trap);
  const done = () => { if (!menuOpen) menu.hidden = true; };
  if (reduced) done(); else setTimeout(done, 260);
  burger.focus({ preventScroll: true });
}
burger && burger.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
menu && menu.querySelectorAll('[data-menu-close]').forEach((b) => b.addEventListener('click', closeMenu));
menu && menu.addEventListener('click', (e) => { if (e.target.closest('a[href]')) closeMenu(); });
matchMedia('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) closeMenu(); });

/* ── Light and dark ────────────────────────────────────────────── */
/* partials/head.html picks the theme before the first paint: the reader's own choice, remembered on this device, else
   their system's. The switch in the header changes it. Where the browser has view transitions the new theme opens as a
   circle from the switch over the old one; elsewhere, and with reduced motion, it changes in one frame. Either way every
   colour moves together (html.theme-switching holds transitions back). Canvases listen for `themechange` and repaint. */
const THEME_KEY = 'tq-theme';
const THEME_COLOR = { light: '#ECF0F6', dark: '#05080F' };
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const savedTheme = () => { try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark' ? t : null; } catch { return null; } };
export const theme = () => (html.dataset.theme === 'dark' ? 'dark' : 'light');
function syncThemeUI(t) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[t]);
  document.querySelectorAll('[data-theme-toggle]').forEach((b) => {
    b.setAttribute('aria-checked', String(t === 'dark'));
    b.title = t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  });
}
function paintTheme(t) {
  html.dataset.theme = t;
  syncThemeUI(t);
  window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: t } }));
}
const settle = () => requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove('theme-switching', 'theme-vt')));
function applyTheme(t) { html.classList.add('theme-switching'); paintTheme(t); settle(); }
export function setTheme(t, from) {
  if (t !== 'light' && t !== 'dark') return;
  try { localStorage.setItem(THEME_KEY, t); } catch { /* private mode: the choice lasts for this page */ }
  if (t === theme()) return;
  if (reduced || !from || typeof document.startViewTransition !== 'function' || document.visibilityState !== 'visible') { applyTheme(t); return; }
  html.classList.add('theme-switching', 'theme-vt');
  const { x, y } = from, r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = document.startViewTransition(() => paintTheme(t));
  vt.ready.then(() => html.animate(
    { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
    { duration: 720, easing: 'cubic-bezier(.65, 0, .25, 1)', pseudoElement: '::view-transition-new(root)' }
  )).catch(() => {});
  vt.finished.then(settle, settle);
}
syncThemeUI(theme());
document.querySelectorAll('[data-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
  const k = (b.querySelector('.theme__knob') || b).getBoundingClientRect();
  setTheme(theme() === 'dark' ? 'light' : 'dark', { x: k.left + k.width / 2, y: k.top + k.height / 2 });
}));
/* until the reader chooses, the page follows the system as it changes; a choice made in another tab applies here too */
const wanted = () => savedTheme() || (systemDark.matches ? 'dark' : 'light');
systemDark.addEventListener('change', () => { if (!savedTheme() && wanted() !== theme()) applyTheme(wanted()); });
window.addEventListener('storage', (e) => { if (e.key === THEME_KEY && wanted() !== theme()) applyTheme(wanted()); });
window.addEventListener('pageshow', (e) => { if (e.persisted && wanted() !== theme()) applyTheme(wanted()); });

/* ── The stamp ─────────────────────────────────────────────────── */
/* Issuing a stamp: the one motion signature. Used where a stamp is actually issued or shown being issued. */
export function stamp(el, { delay = 0, rotate = -6 } = {}) {
  if (!el || el.classList.contains('is-stamped')) return null;
  if (reduced) { el.classList.add('is-stamped'); return null; }
  return gsap.timeline({ delay, onComplete: () => { el.classList.add('is-stamped'); gsap.set(el, { clearProps: 'opacity,transform' }); } })
    .fromTo(el, { opacity: 0, scale: 1.7, rotate: rotate - 12 }, { opacity: 1, scale: .97, rotate, duration: .34, ease: 'power4.in' })
    .to(el, { scale: 1, duration: .5, ease: 'elastic.out(1, .5)' });
}

/* Fill empty seal shells. Seals under 56px drop the ring text, which cannot be read that small. */
export function hydrateSeals(scope = document) {
  scope.querySelectorAll('.seal:empty').forEach((el) => {
    const compact = el.classList.contains('seal--sm') || el.classList.contains('seal--xs') || el.hasAttribute('data-compact');
    el.innerHTML = sealSVG({ compact });
  });
}

/* ── Forms and feedback ────────────────────────────────────────── */
/* A button that is working: disabled, announced, with a quiet progress mark. */
export function busy(btn, on) {
  if (!btn) return;
  btn.classList.toggle('is-busy', on);
  btn.disabled = on;
  btn.setAttribute('aria-busy', String(on));
}

/* Mark a field invalid, or valid again. The message is the field's own .field__err (rewritten when one is given),
   announced through aria-describedby only while it applies. */
let errN = 0;
export function setInvalid(el, bad, msg) {
  const f = el && el.closest('.field');
  if (!f) return;
  f.classList.toggle('is-invalid', !!bad);
  if (bad) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
  const err = f.querySelector('.field__err');
  if (!err) return;
  if (msg) err.textContent = msg;
  if (!err.id) err.id = `${el.id || 'field'}-err-${++errN}`;
  const ids = new Set((el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
  if (bad) ids.add(err.id); else ids.delete(err.id);
  if (ids.size) el.setAttribute('aria-describedby', [...ids].join(' ')); else el.removeAttribute('aria-describedby');
}
/* A field stops being wrong the moment someone edits it. */
export function clearOnEdit(form) {
  form.querySelectorAll('input, textarea, select').forEach((el) => {
    const ev = el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT' || el.type === 'file' ? 'change' : 'input';
    el.addEventListener(ev, () => setInvalid(el, false));
  });
}

export function initAccordions(scope = document) {
  scope.querySelectorAll('.acc').forEach((acc, n) => {
    const single = acc.dataset.single !== undefined;
    acc.querySelectorAll('.acc__item').forEach((item, i) => {
      const btn = item.querySelector('.acc__btn'), panel = item.querySelector('.acc__panel');
      const id = `acc-${n}-${i}`;
      panel.id = id; btn.setAttribute('aria-controls', id);
      btn.setAttribute('aria-expanded', String(item.classList.contains('is-open')));
      btn.addEventListener('click', () => {
        const open = item.classList.contains('is-open');
        if (single) acc.querySelectorAll('.acc__item.is-open').forEach((o) => { if (o !== item) { o.classList.remove('is-open'); o.querySelector('.acc__btn').setAttribute('aria-expanded', 'false'); } });
        item.classList.toggle('is-open', !open);
        btn.setAttribute('aria-expanded', String(!open));
      });
    });
  });
}

let toastEl, toastTimer;
export function toast(msg, { ms = 4200 } = {}) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
    toastEl.innerHTML = `<span class="seal seal--xs" aria-hidden="true">${sealSVG({ compact: true })}</span><span data-msg></span>`;
    document.body.appendChild(toastEl);
  }
  toastEl.querySelector('[data-msg]').textContent = msg;
  requestAnimationFrame(() => toastEl.classList.add('is-in'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-in'), ms);
}

/* The footer newsletter: stored by the API. */
document.querySelectorAll('[data-newsletter]').forEach((form) => {
  const input = form.querySelector('input[type=email]');
  const msg = form.querySelector('[data-newsletter-msg]');
  const btn = form.querySelector('button');
  const say = (text, bad) => { msg.textContent = text; form.classList.toggle('is-invalid', !!bad); };
  input.addEventListener('input', () => { if (form.classList.contains('is-invalid')) say('', false); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!input.value || !input.validity.valid) { say('That address doesn’t look complete.', true); input.focus(); return; }
    busy(btn, true);
    try { await api.post('/newsletter', { email: input.value }); say('Subscribed. The next dispatch arrives early next month.'); input.value = ''; }
    catch (err) { say(err.status === 0 || err.status === 503 ? 'The list can’t be reached right now. Try again later.' : err.message, true); }
    finally { busy(btn, false); }
  });
});

/* The reviewer's notes write themselves once, the first time each is on screen: the words, then the pen stroke
   that points at what they are about. With reduced motion they are simply there. */
export function initScribbles(scope = document) {
  scope.querySelectorAll('.scribble:not(.is-written):not([data-manual])').forEach((el) => {
    if (reduced) { el.classList.add('is-written'); return; }
    whenVisible(el, () => el.classList.add('is-written'), { rootMargin: '0px 0px -18% 0px' });
  });
}

/* Images fade in once decoded, so nothing pops. */
export function initImages(scope = document) {
  scope.querySelectorAll('img[data-fade]').forEach((img) => {
    const done = () => img.classList.add('is-loaded');
    if (img.complete) done(); else img.addEventListener('load', done, { once: true });
  });
}

/* Session-aware chrome: a signed-in member sees “Dashboard” where a visitor sees “Sign in”. */
export async function applySession() {
  const s = await loadSession();
  if (!s.user) return s;
  document.querySelectorAll('[data-account-link]').forEach((a) => { a.href = href('/dashboard/'); a.textContent = 'Dashboard'; });
  return s;
}

/* ── Password fields: show what's typed ───────────────────────── */
export function initReveal(scope = document) {
  scope.querySelectorAll('[data-reveal]').forEach((btn) => {
    const input = btn.parentElement.querySelector('input');
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.querySelector('[data-reveal-word]').textContent = show ? 'Hide' : 'Show';
      input.focus({ preventScroll: true });
    });
  });
}

/* ── The closing call: who already carries the stamp ──────────── */
/* The faces and first names of the members the site leads with (Tyler Shirakawa, Noah Duran, Ahmad Khalid), and how
   many more there are, read from the members themselves when the call comes near. Until then, and without script, it
   reads as the verified count from the build. */
export function initCTA(scope = document) {
  const row = scope.querySelector('[data-cta-people]');
  if (!row) return;
  whenVisible(row, async () => {
    try {
      const { members } = await loadMembers();
      const verified = members.filter(isVerified);
      const lead = FEATURED.world.map((id) => verified.find((m) => m.id === id)).filter(Boolean);
      if (!lead.length) return;
      const more = verified.length - lead.length;
      const names = lead.map((m) => m.first || m.name);
      const and = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}` : list[0]);
      const text = more > 0 ? `Join ${names.join(', ')} and ${more} more verified members`
        : names.length > 1 ? `Join ${and(names)}, all verified` : `Join ${names[0]}, a verified member`;
      row.querySelector('[data-cta-faces]').innerHTML = lead.map((m) => portrait(m, { size: 34 })).join('');
      row.querySelector('[data-cta-people-text]').textContent = text;
      initImages(row);
    } catch { /* the build's count stays */ }
  }, { rootMargin: '600px 0px' });
}

/* ── Boot ──────────────────────────────────────────────────────── */
/* Build the page's data-driven DOM, then run its one choreographed moment, if it has one. */
export async function boot(pageInit, heroInit) {
  applySession().catch(() => {});
  try { if (typeof pageInit === 'function') await pageInit(); }
  catch (e) { console.error('[trulinq] page init failed', e); }
  hydrateSeals();
  initAccordions();
  initImages();
  initScribbles();
  initCTA();
  initReveal();
  html.classList.add('is-ready');
  if (typeof heroInit === 'function') {
    try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]); heroInit(); }
    catch (e) { console.error('[trulinq] page motion failed', e); }
  }
}

export { gsap };
