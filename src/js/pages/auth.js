import '../../styles/main.css';
import '../../styles/pages/auth.css';
import { boot, gsap, reduced, stamp, toast, hydrateSeals, go } from '../main.js';
import { idCard, href } from '../ui.js';
import { api, ApiError } from '../api.js';
import { loadMembers, loadStats, loadSession } from '../data.js';

const params = new URLSearchParams(location.search);
const forms = { signin: document.querySelector('[data-form="signin"]'), signup: document.querySelector('[data-form="signup"]') };
let mode = params.get('mode') === 'signup' ? 'signup' : 'signin';
const next = params.get('next');
const resetToken = params.get('reset');
const refCode = params.get('ref') || params.get('code') || '';

function fmtCode(v) { const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^TL/, '').slice(0, 8); let out = 'TL'; if (raw.length) out += '-' + raw.slice(0, 4); if (raw.length > 4) out += '-' + raw.slice(4, 8); return out; }
const normalize = (v) => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const inv = (el, bad, msg) => { const f = el.closest('.field'); f.classList.toggle('is-invalid', bad); if (msg) { const e = f.querySelector('.field__err'); if (e) e.textContent = msg; } };
const busy = (form, on) => form.querySelectorAll('button[type=submit]').forEach((b) => (b.disabled = on));

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

function destination() { return next && next.startsWith('/') && !next.startsWith('//') ? next : href('/dashboard/'); }
function finish(label = 'Dashboard') { const to = destination(); setTimeout(() => go(to, to.includes('/members/') ? 'Member' : label), 400); }
/** Every failure lands somewhere honest: on the field it belongs to when the server said so, otherwise in a toast. */
function explain(e, fields) {
  if (!(e instanceof ApiError)) { toast('Something went wrong. Try again.'); return false; }
  if (e.status === 0 || e.status === 503) { toast('The backend is not reachable right now. Try again in a moment.'); return false; }
  let placed = false;
  for (const [path, el] of Object.entries(fields)) { const msg = e.field(path); if (msg) { inv(el, true, msg); if (!placed) el.focus(); placed = true; } }
  if (placed) return true;
  if (e.status === 429) toast(e.message);
  return false;
}

async function build() {
  const stack = document.querySelector('[data-stack]');
  const [{ members, byId }, stats, session] = await Promise.all([loadMembers(), loadStats(), loadSession()]);
  if (session.user && !resetToken) { go(destination(), 'Dashboard'); return; }
  const picks = ['grace-okafor', 'marcus-hale', 'sofia-marin'].map((id) => byId[id]).filter(Boolean);
  const cards = picks.length === 3 ? picks : members.slice(0, 3);
  stack.innerHTML = cards.map((m, i) => idCard(m, { tilt: [-3, 2, -1.5][i], stamp: true })).join('');
  stack.querySelectorAll('.seal').forEach((s) => s.setAttribute('data-manual', ''));
  hydrateSeals(stack);
  const ledger = document.querySelectorAll('.auth__ledger .ledger__row b');
  if (ledger[0]) ledger[0].textContent = stats.people; if (ledger[1]) ledger[1].textContent = stats.verified;

  document.querySelector('[data-modes]').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b && b.dataset.mode !== mode) show(b.dataset.mode); });
  document.querySelectorAll('[data-switch]').forEach((b) => b.addEventListener('click', () => show(b.dataset.switch)));
  document.querySelector('[data-google]').addEventListener('click', () => toast('Google sign-in is not set up yet. Use your email and password.'));
  document.querySelector('[data-forgot]').addEventListener('click', () => { const r = document.querySelector('[data-reset]'); r.hidden = !r.hidden; });
  document.querySelector('[data-reset-send]').addEventListener('click', async () => {
    const e = document.querySelector('#si-email'); if (!e.validity.valid || !e.value) { inv(e, true); e.focus(); return; }
    try {
      const r = await api.post('/auth/password-reset/request', { email: e.value });
      toast(r.delivered ? 'Reset link sent to ' + e.value : 'Password-reset email is not configured on this deployment yet. Write to support@trulinq.com.');
      document.querySelector('[data-reset]').hidden = true;
    } catch (err) { explain(err, { email: e }); }
  });
  document.querySelectorAll('.auth__card .input').forEach((el) => el.addEventListener('input', () => inv(el, false)));

  const em = document.querySelector('#si-email'), pw = document.querySelector('#si-pass');
  if (resetToken) { pw.setAttribute('autocomplete', 'new-password'); toast('Enter your email and a new password to finish the reset.'); }
  forms.signin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b1 = !em.validity.valid || !em.value, b2 = pw.value.length < 1;
    inv(em, b1, 'Enter the email on your account.'); inv(pw, b2, 'Enter your password.');
    if (b1) return em.focus(); if (b2) return pw.focus();
    busy(forms.signin, true);
    try {
      if (resetToken) { await api.post('/auth/password-reset/confirm', { token: resetToken, password: pw.value }); toast('Password updated. You are signed in.'); }
      else await api.post('/auth/login', { email: em.value, password: pw.value });
      finish('Dashboard');
    } catch (err) {
      busy(forms.signin, false);
      if (err instanceof ApiError && err.status === 401) { inv(em, true, 'That email and password do not match.'); inv(pw, true, 'Check your password.'); pw.focus(); return; }
      if (err instanceof ApiError && err.code === 'invalid_token') { toast(err.message); return; }
      if (!explain(err, { email: em, password: pw })) toast(err.message || 'Could not sign in.');
    }
  });

  const code = document.querySelector('#su-code'), name = document.querySelector('#su-name'), sem = document.querySelector('#su-email'), agree = document.querySelector('[data-agree]');
  code.addEventListener('input', () => (code.value = fmtCode(code.value)));
  code.addEventListener('focus', () => { if (!code.value) code.value = 'TL-'; });
  if (refCode) {
    code.value = fmtCode(refCode);
    api.get(`/referrals/${encodeURIComponent(normalize(refCode))}`).then((r) => toast(`Invited by ${r.referrer.name}.`)).catch((err) => { if (err instanceof ApiError && err.status === 404) inv(code, true, 'That invitation code is not valid.'); });
  }
  const pass = document.querySelector('[data-pass]'), meter = document.querySelector('[data-strength]'), label = document.querySelector('[data-strength-label]');
  pass.addEventListener('input', () => { const v = pass.value; let s = 0; if (v.length >= 10) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v) || v.length >= 16) s++; meter.dataset.level = v ? s : 0; label.textContent = ['Use a long phrase you’ll remember.', 'Too short.', 'Getting there.', 'Good.', 'Strong.'][v ? s : 0]; });
  forms.signup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b0 = normalize(code.value).replace(/^TL/, '').length < 6, b1 = name.value.trim().length < 2, b2 = !sem.validity.valid || !sem.value, b3 = pass.value.length < 10, b4 = !agree.checked;
    inv(code, b0, 'Enter the full code, like TL-7K2M-Q9RD.'); inv(name, b1, 'Enter your name as it appears on your ID.'); inv(sem, b2, 'Enter a working email.'); inv(pass, b3, 'Use at least 10 characters.'); agree.closest('.field').classList.toggle('is-invalid', b4);
    if (b0) return code.focus(); if (b1) return name.focus(); if (b2) return sem.focus(); if (b3) return pass.focus(); if (b4) return;
    busy(forms.signup, true);
    try {
      const r = await api.post('/auth/signup', { name: name.value.trim(), email: sem.value.trim(), password: pass.value, code: code.value, agree: true });
      toast(r.referral ? `Welcome to Trulinq. Invited by ${r.referral.referrer.name}.` : 'Welcome to Trulinq.');
      finish('Dashboard');
    } catch (err) {
      busy(forms.signup, false);
      if (err instanceof ApiError && err.code === 'email_taken') { inv(sem, true, 'An account with that email already exists. Sign in instead.'); sem.focus(); return; }
      if (err instanceof ApiError && (err.code === 'invalid_code' || err.code === 'code_required')) { inv(code, true, err.message); code.focus(); return; }
      if (!explain(err, { code, name, email: sem, password: pass })) toast(err.message || 'Could not create the account.');
    }
  });
}

function hero() {
  if (!forms.signin.isConnected) return;
  show(mode, false);
  const cards = document.querySelectorAll('[data-stack] .idcard');
  if (reduced) { cards.forEach((c) => c.querySelector('.seal').classList.add('is-stamped')); return; }
  gsap.from(cards, { y: 60, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .15, delay: .1, clearProps: 'opacity' });
  cards.forEach((c, i) => stamp(c.querySelector('.seal'), { delay: .8 + i * .2, rotate: -6 }));
  gsap.from('.auth__card:not([hidden])', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', delay: .2, clearProps: 'transform,opacity' });
}

boot(build, hero);
