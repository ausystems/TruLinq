import '../../styles/main.css';
import '../../styles/pages/auth.css';
import { boot, gsap, reduced, stamp, toast, hydrateSeals } from '../main.js';
import { idCard, href } from '../ui.js';
import { byId } from '../../data/members.js';

const forms = { signin: document.querySelector('[data-form="signin"]'), signup: document.querySelector('[data-form="signup"]') };
let mode = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'signin';
const next = new URLSearchParams(location.search).get('next');

function fmtCode(v) { const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^TL/, '').slice(0, 8); let out = 'TL'; if (raw.length) out += '-' + raw.slice(0, 4); if (raw.length > 4) out += '-' + raw.slice(4, 8); return out; }
const inv = (el, bad) => el.closest('.field').classList.toggle('is-invalid', bad);

function show(m, animate = true) {
  mode = m;
  document.querySelectorAll('[data-mode]').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
  const to = forms[m], from = forms[m === 'signin' ? 'signup' : 'signin'];
  const u = new URL(location.href); u.searchParams.set('mode', m); history.replaceState(null, '', u);
  document.title = (m === 'signin' ? 'Sign in' : 'Create account') + ' — Trulinq';
  const reveal = () => { to.hidden = false; const f = to.querySelector('input'); if (reduced || !animate) { f && f.focus({ preventScroll: true }); return; } gsap.fromTo(to, { x: m === 'signup' ? 24 : -24, opacity: 0 }, { x: 0, opacity: 1, duration: .7, ease: 'expo.out', clearProps: 'transform', onComplete: () => f && f.focus({ preventScroll: true }) }); };
  if (!from.hidden && animate && !reduced) gsap.to(from, { x: m === 'signup' ? -24 : 24, opacity: 0, duration: .3, ease: 'power2.in', onComplete: () => { from.hidden = true; gsap.set(from, { clearProps: 'all' }); reveal(); } });
  else { from.hidden = true; reveal(); }
}

function finish() { toast('Signed in as a preview account.'); setTimeout(() => (location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : href('/dashboard/')), 600); }

function build() {
  const stack = document.querySelector('[data-stack]');
  stack.innerHTML = ['grace-okafor', 'marcus-hale', 'sofia-marin'].map((id, i) => idCard(byId[id], { tilt: [-3, 2, -1.5][i], stamp: true })).join('');
  stack.querySelectorAll('.seal').forEach((s) => s.setAttribute('data-manual', ''));
  hydrateSeals(stack);
  document.querySelector('[data-modes]').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b && b.dataset.mode !== mode) show(b.dataset.mode); });
  document.querySelectorAll('[data-switch]').forEach((b) => b.addEventListener('click', () => show(b.dataset.switch)));
  document.querySelector('[data-google]').addEventListener('click', () => toast('Google sign-in is switched off in this preview.'));
  document.querySelector('[data-forgot]').addEventListener('click', () => { const r = document.querySelector('[data-reset]'); r.hidden = !r.hidden; });
  document.querySelector('[data-reset-send]').addEventListener('click', () => { const e = document.querySelector('#si-email'); if (!e.validity.valid || !e.value) { inv(e, true); e.focus(); return; } toast('Reset link sent to ' + e.value); document.querySelector('[data-reset]').hidden = true; });
  document.querySelectorAll('.auth__card .input').forEach((el) => el.addEventListener('input', () => inv(el, false)));

  forms.signin.addEventListener('submit', (e) => { e.preventDefault(); const em = document.querySelector('#si-email'), pw = document.querySelector('#si-pass'); const b1 = !em.validity.valid || !em.value, b2 = pw.value.length < 1; inv(em, b1); inv(pw, b2); if (b1) return em.focus(); if (b2) return pw.focus(); finish(); });

  const code = document.querySelector('#su-code'); code.addEventListener('input', () => (code.value = fmtCode(code.value))); code.addEventListener('focus', () => { if (!code.value) code.value = 'TL-'; });
  const pass = document.querySelector('[data-pass]'), meter = document.querySelector('[data-strength]'), label = document.querySelector('[data-strength-label]');
  pass.addEventListener('input', () => { const v = pass.value; let s = 0; if (v.length >= 10) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v) || v.length >= 16) s++; meter.dataset.level = v ? s : 0; label.textContent = ['Use a long phrase you’ll remember.', 'Too short.', 'Getting there.', 'Good.', 'Strong.'][v ? s : 0]; });
  forms.signup.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.querySelector('#su-name'), em = document.querySelector('#su-email'), agree = document.querySelector('[data-agree]');
    const b0 = !/^TL-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code.value), b1 = name.value.trim().length < 2, b2 = !em.validity.valid || !em.value, b3 = pass.value.length < 10, b4 = !agree.checked;
    inv(code, b0); inv(name, b1); inv(em, b2); inv(pass, b3); agree.closest('.field').classList.toggle('is-invalid', b4);
    if (b0) return code.focus(); if (b1) return name.focus(); if (b2) return em.focus(); if (b3) return pass.focus(); if (b4) return;
    finish();
  });
}

function hero() {
  show(mode, false);
  const cards = document.querySelectorAll('[data-stack] .idcard');
  if (reduced) { cards.forEach((c) => c.querySelector('.seal').classList.add('is-stamped')); return; }
  gsap.from(cards, { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .15, delay: .1, clearProps: 'opacity' });
  cards.forEach((c, i) => stamp(c.querySelector('.seal'), { delay: .8 + i * .2, rotate: -6 }));
  gsap.from('.auth__card:not([hidden])', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', delay: .2, clearProps: 'transform,opacity' });
}

boot(build, hero);
