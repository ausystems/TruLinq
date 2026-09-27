import '../../styles/main.css';
import '../../styles/pages/auth.css';
import { boot, busy, go, setInvalid, clearOnEdit, toast } from '../main.js';
import { idCard, href, esc } from '../ui.js';
import { api, ApiError } from '../api.js';
import { loadMembers, loadStats, loadSession } from '../data.js';
import { FEATURED } from '../../data/editorial.js';
import { SITE } from '../../data/site.js';

const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const forms = { signin: $('[data-form="signin"]'), signup: $('[data-form="signup"]') };
let mode = params.get('mode') === 'signup' ? 'signup' : 'signin';
const next = params.get('next');
const resetToken = params.get('reset');
const refCode = params.get('ref') || params.get('code') || '';

/* Codes are typed however people like; letters and digits are what count. */
const normalize = (v) => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const codeOK = (v) => { const n = normalize(v).replace(/^TL(?=[A-Z0-9]{6,})/, ''); return n.length >= 6 && n.length <= 12; };
const unreachable = (e) => !(e instanceof ApiError) || e.status === 0 || e.status === 503;
const UNREACHABLE = `Accounts can’t be reached right now. Try again in a moment, or write to ${SITE.email.support}.`;

function formError(form, msg) { const el = form.querySelector('.form-error'); el.textContent = msg || ''; el.hidden = !msg; }

function show(m, focus = true) {
  mode = m;
  document.querySelectorAll('[data-mode]').forEach((b) => { const on = b.dataset.mode === m; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
  forms.signin.hidden = m !== 'signin'; forms.signup.hidden = m !== 'signup';
  const u = new URL(location.href); u.searchParams.set('mode', m); history.replaceState(null, '', u);
  document.title = `${m === 'signin' ? (resetToken ? 'Set a new password' : 'Sign in') : 'Create account'} — Trulinq`;
  if (focus) forms[m].querySelector('input').focus({ preventScroll: true });
}

/* Only same-site paths are honoured as a destination after signing in. */
function destination() { return next && next.startsWith('/') && !next.startsWith('//') ? next : href('/dashboard/'); }

/* Server field errors land on their fields; everything else is said once, above the button. */
function explain(form, e, fields) {
  if (unreachable(e)) { formError(form, UNREACHABLE); return; }
  let placed = false;
  for (const [path, el] of Object.entries(fields)) {
    const msg = e.field(path);
    if (msg) { setInvalid(el, true, msg); if (!placed) el.focus(); placed = true; }
  }
  if (!placed) formError(form, e.message);
}

async function build() {
  const [session, { members, byId }, stats] = await Promise.all([loadSession(), loadMembers(), loadStats().catch(() => null)]);
  if (session.user && !resetToken) { go(destination()); return; }

  const cards = FEATURED.auth.map((id) => byId[id]).filter(Boolean);
  $('[data-stack]').innerHTML = (cards.length ? cards : members.slice(0, 3)).map((m) => idCard(m)).join('');
  if (stats) ['people', 'verified', 'revoked'].forEach((k) => { const el = $(`[data-stat="${k}"]`); if (el && stats[k] != null) el.textContent = stats[k]; });

  document.querySelector('[data-modes]').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b && b.dataset.mode !== mode) show(b.dataset.mode); });
  document.querySelectorAll('[data-switch]').forEach((b) => b.addEventListener('click', () => show(b.dataset.switch)));
  Object.values(forms).forEach((f) => { clearOnEdit(f); f.addEventListener('input', () => formError(f, '')); });

  /* ── Sign in (or finish a password reset) ── */
  const em = $('#si-email'), pw = $('#si-pass');
  const resetBox = $('[data-reset]'), forgot = $('[data-forgot]');
  if (resetToken) {
    $('#signin-title').textContent = 'Set a new password';
    forms.signin.querySelector('.auth__lead').textContent = 'Enter your email and choose a new password of 10 or more characters.';
    $('[data-pass-label]').textContent = 'New password';
    $('[data-signin-label]').textContent = 'Update password';
    pw.setAttribute('autocomplete', 'new-password');
    forgot.hidden = true;
  }
  forgot.addEventListener('click', () => { resetBox.hidden = !resetBox.hidden; forgot.setAttribute('aria-expanded', String(!resetBox.hidden)); if (!resetBox.hidden) em.focus(); });
  $('[data-reset-send]').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!em.value.trim() || !em.validity.valid) { setInvalid(em, true, 'Enter the email on your account, then send the link.'); em.focus(); return; }
    busy(btn, true);
    try {
      const r = await api.post('/auth/password-reset/request', { email: em.value.trim() });
      resetBox.querySelector('p').textContent = r.delivered
        ? `If an account uses ${em.value.trim()}, a reset link is on its way.`
        : `Reset emails aren’t connected on this deployment yet. Write to ${SITE.email.support} and a person will help.`;
    } catch (err) { explain(forms.signin, err, { email: em }); }
    finally { busy(btn, false); }
  });
  forms.signin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b1 = !em.value.trim() || !em.validity.valid, b2 = resetToken ? pw.value.length < 10 : !pw.value;
    setInvalid(em, b1, 'Enter the email on your account.');
    setInvalid(pw, b2, resetToken ? 'Use at least 10 characters.' : 'Enter your password.');
    if (b1) return em.focus();
    if (b2) return pw.focus();
    const btn = forms.signin.querySelector('button[type=submit]');
    busy(btn, true);
    try {
      if (resetToken) { await api.post('/auth/password-reset/confirm', { token: resetToken, password: pw.value }); toast('Password updated. You’re signed in.'); }
      else await api.post('/auth/login', { email: em.value.trim(), password: pw.value });
      go(destination());
    } catch (err) {
      busy(btn, false);
      if (err instanceof ApiError && err.status === 401) { formError(forms.signin, 'That email and password don’t match an account.'); pw.focus(); pw.select(); return; }
      if (err instanceof ApiError && err.code === 'invalid_token') { formError(forms.signin, 'This reset link has expired or was already used. Ask for a new one.'); return; }
      explain(forms.signin, err, { email: em, password: pw });
    }
  });

  /* ── Create an account ── */
  const code = $('#su-code'), name = $('#su-name'), biz = $('#su-business'), country = $('#su-country'), sem = $('#su-email'), pass = $('[data-pass]'), agree = $('[data-agree]');
  const hint = $('[data-code-hint]');
  code.addEventListener('input', () => { const pos = code.selectionStart, before = code.value; code.value = before.toUpperCase().replace(/[^A-Z0-9-]/g, ''); if (code.value.length === before.length) code.setSelectionRange(pos, pos); });
  const checkCode = async (v) => {
    try {
      const r = await api.get(`/referrals/${encodeURIComponent(normalize(v))}`);
      hint.innerHTML = `Invited by <b>${esc(r.referrer.name)}</b>.`;
      setInvalid(code, false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setInvalid(code, true, 'That invitation code isn’t valid. Check it with the member who gave it to you.');
    }
  };
  if (refCode) { code.value = refCode.toUpperCase().replace(/[^A-Z0-9-]/g, ''); checkCode(code.value); }
  code.addEventListener('change', () => { if (codeOK(code.value)) checkCode(code.value); });

  const meter = $('[data-strength]'), label = $('[data-strength-label]');
  pass.addEventListener('input', () => {
    const v = pass.value; let s = 0;
    if (v.length >= 10) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v) || v.length >= 16) s++;
    meter.dataset.level = v ? String(s) : '0';
    label.textContent = !v ? 'A long phrase you’ll remember works best.' : v.length < 10 ? `${10 - v.length} more character${10 - v.length === 1 ? '' : 's'} to go.` : ['', 'Long enough.', 'Good.', 'Strong.', 'Very strong.'][s];
  });
  forms.signup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bad = {
      code: !codeOK(code.value), name: name.value.trim().length < 2, email: !sem.value.trim() || !sem.validity.valid,
      pass: pass.value.length < 10, agree: !agree.checked
    };
    setInvalid(code, bad.code, 'Enter the full code a member gave you: 6 to 12 letters and numbers.');
    setInvalid(name, bad.name); setInvalid(sem, bad.email); setInvalid(pass, bad.pass); setInvalid(agree, bad.agree);
    const first = [[bad.code, code], [bad.name, name], [bad.email, sem], [bad.pass, pass], [bad.agree, agree]].find(([b]) => b);
    if (first) { first[1].focus(); return; }
    const btn = forms.signup.querySelector('button[type=submit]');
    busy(btn, true);
    try {
      const r = await api.post('/auth/signup', { name: name.value.trim(), email: sem.value.trim(), password: pass.value, code: code.value.trim(), business: biz.value.trim() || undefined, country: country.value.trim() || undefined, agree: true });
      toast(r.referral ? `Welcome to Trulinq. You were invited by ${r.referral.referrer.name}.` : 'Welcome to Trulinq.');
      go(destination());
    } catch (err) {
      busy(btn, false);
      if (err instanceof ApiError && err.code === 'email_taken') { setInvalid(sem, true, 'An account already uses this email. Sign in instead.'); sem.focus(); return; }
      if (err instanceof ApiError && (err.code === 'invalid_code' || err.code === 'code_required')) { setInvalid(code, true, err.message); code.focus(); return; }
      explain(forms.signup, err, { code, name, email: sem, password: pass, business: biz, country });
    }
  });
}

boot(async () => { show(mode, false); await build(); });
