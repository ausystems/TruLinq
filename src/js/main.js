/* The Trulinq engine: navigation, the menu, stamps, accordions, forms, toasts and the page boot.
   Scrolling belongs to the browser: nothing is pinned, smoothed, hijacked or tied to the scroll position. Motion is
   reserved for moments that mean something (a stamp being issued, a score being read, a state changing). */
import gsap from 'gsap';
import { sealSVG, href } from './ui.js';
import { api } from './api.js';
import { loadSession } from './data.js';

const html = document.documentElement;
html.classList.remove('no-js');
html.classList.add('js');
export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('nomotion');
export const isTouch = matchMedia('(hover: none), (pointer: coarse)').matches;
if (reduced) html.classList.add('reduced-motion');

gsap.defaults({ ease: 'expo.out', duration: .6 });
window.__gsap = gsap; // lets automated checks drive the ticker when a tab is hidden

/* ── Visibility ────────────────────────────────────────────────── */
/* Run a callback once, the first time an element comes on screen. */
export function whenVisible(el, cb, { rootMargin = '0px 0px -12% 0px', threshold = 0 } = {}) {
  if (!el) return () => {};
  if (!('IntersectionObserver' in window)) { cb(); return () => {}; }
  const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); cb(); } }, { rootMargin, threshold });
  io.observe(el);
  return () => io.disconnect();
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

/* ── Boot ──────────────────────────────────────────────────────── */
/* Build the page's data-driven DOM, then run its one choreographed moment, if it has one. */
export async function boot(pageInit, heroInit) {
  applySession().catch(() => {});
  try { if (typeof pageInit === 'function') await pageInit(); }
  catch (e) { console.error('[trulinq] page init failed', e); }
  hydrateSeals();
  initAccordions();
  initImages();
  html.classList.add('is-ready');
  if (typeof heroInit === 'function') {
    try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 1200))]); heroInit(); }
    catch (e) { console.error('[trulinq] page motion failed', e); }
  }
}

export { gsap };
