import '../../styles/main.css';
import '../../styles/pages/verify.css';
import { boot, busy, go, stamp, setInvalid, clearOnEdit, reduced } from '../main.js';
import { INDUSTRIES, loadSession } from '../data.js';
import { api, ApiError } from '../api.js';
import { href, esc, fmtDate } from '../ui.js';
import { SITE } from '../../data/site.js';

/* The application is kept in this tab's session storage while it is being written, so a reload or the detour to
   create an account never loses it. It is cleared the moment the application is submitted. The ID document itself
   is never stored; it stays in memory until it is uploaded. */
const KEY = 'tq-verify';
const blank = () => ({ step: 0, values: {}, idtype: 'Passport' });
function readState() { try { const s = JSON.parse(sessionStorage.getItem(KEY) || 'null'); return s && typeof s === 'object' ? { ...blank(), ...s, values: { ...(s.values || {}) } } : blank(); } catch { return blank(); } }
const state = readState();
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode: the form still works, it just won't survive a reload */ } };
let fileObj = null;

const $ = (s) => document.querySelector(s);
const cards = [...document.querySelectorAll('[data-step]')];
const card = (i) => cards.find((c) => c.dataset.step === String(i));
const MAX_FILE = 10 * 1024 * 1024;
const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const adultBy = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); })();
const normalize = (v) => (v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const codeOK = (v) => { const n = normalize(v).replace(/^TL(?=[A-Z0-9]{6,})/, ''); return n.length >= 6 && n.length <= 12; };
const websiteOK = (v) => !v.trim() || /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v.trim());
const dobOK = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= adultBy && v >= '1900-01-01';

/* What each step needs, checked against the values the step holds. */
const RULES = {
  0: [['code', (v) => codeOK(v || '')]],
  1: [['first', (v) => (v || '').trim().length >= 1], ['last', (v) => (v || '').trim().length >= 1], ['dob', (v) => dobOK(v || '')], ['country', (v) => !!v]],
  2: [['business', (v) => (v || '').trim().length >= 2], ['registration', (v) => (v || '').trim().length >= 4], ['state', (v) => (v || '').trim().length >= 2], ['website', (v) => websiteOK(v || '')], ['industry', (v) => !!v], ['role', (v) => (v || '').trim().length >= 2], ['authorised', (v) => v === true]],
  3: [['terms', (v) => v === true]]
};

function collect(i) {
  const c = card(i); if (!c || c.tagName !== 'FORM') return;
  c.querySelectorAll('input[name], select[name]').forEach((el) => {
    if (el.type === 'file') return;
    if (el.type === 'radio') { if (el.checked) state.idtype = el.value; return; }
    state.values[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  });
  save();
}
function restore() {
  cards.forEach((c) => c.querySelectorAll('input[name], select[name]').forEach((el) => {
    if (el.type === 'file') return;
    if (el.type === 'radio') { el.checked = el.value === state.idtype; return; }
    const v = state.values[el.name];
    if (v === undefined) return;
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  }));
}

function validate(i) {
  const c = card(i); let first = null;
  for (const [name, test] of RULES[i]) {
    const el = c.querySelector(`[name="${name}"]`);
    const ok = test(el.type === 'checkbox' ? el.checked : el.value);
    setInvalid(el, !ok);
    if (!ok && !first) first = el;
  }
  if (i === 1) {
    const f = c.querySelector('[data-file]');
    const bad = !fileObj ? 'Add a photo or scan of your ID so a reviewer can match it.' : !FILE_TYPES.includes(fileObj.type) ? 'Use a JPG, PNG, WebP or PDF file.' : fileObj.size > MAX_FILE ? 'That file is over 10 MB. Try a smaller photo or scan.' : '';
    setInvalid(f, !!bad, bad || undefined);
    if (bad && !first) first = f;
  }
  if (first) first.focus();
  return !first;
}
/* The first step whose saved values are incomplete (after a reload or the account detour). */
const firstIncomplete = () => [0, 1, 2].find((i) => RULES[i].some(([name, test]) => !test(state.values[name])));

function paint(i) {
  document.querySelectorAll('[data-step-item]').forEach((li, j) => { li.toggleAttribute('aria-current', j === i); li.classList.toggle('is-done', j < i); });
  document.querySelectorAll('[data-arc]').forEach((a, j) => a.classList.toggle('is-done', j < i));
  $('[data-step-num]').textContent = Math.min(i + 1, 4);
  $('[data-progress-text]').setAttribute('aria-label', i >= 4 ? 'Application submitted' : `Step ${i + 1} of 4`);
}

function summary() {
  const v = state.values;
  const rows = [
    ['Invitation code', normalize(v.code), 0], ['Name', `${v.first || ''} ${v.last || ''}`.trim(), 1], ['Date of birth', v.dob ? fmtDate(v.dob) : '', 1],
    ['ID', [state.idtype, v.country].filter(Boolean).join(' · '), 1], ['Document', fileObj ? fileObj.name : '', 1],
    ['Business', v.business, 2], ['Registration', [v.registration, v.state].filter(Boolean).join(' · '), 2], ['Website', v.website || 'None', 2], ['Industry', v.industry, 2], ['Your role', v.role, 2]
  ];
  $('[data-summary]').innerHTML = rows.map(([k, val, s]) => `<li class="ledger__row"><span>${k}</span><i></i><b>${val ? esc(val) : `<span class="is-missing">${k === 'Document' ? 'Not attached' : 'Missing'}</span>`}<button type="button" class="dossier__edit" data-goto="${s}" aria-label="Edit ${k.toLowerCase()}">Edit</button></b></li>`).join('');
}

let current = 0;
function show(i, { focus = true } = {}) {
  cards.forEach((c) => (c.hidden = c.dataset.step !== String(i)));
  current = i;
  if (typeof i === 'number') { state.step = i; save(); }
  if (i === 3) summary();
  paint(i === 'done' ? 4 : i);
  if (!focus) return;
  const head = card(i).querySelector('h2');
  head.focus({ preventScroll: true });
  const top = $('[data-stage]').getBoundingClientRect().top;
  if (top < 0 || top > innerHeight * .6) $('[data-stage]').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}

async function checkCode(input, { focus = true } = {}) {
  try {
    const r = await api.get(`/referrals/${encodeURIComponent(normalize(input.value))}`);
    $('[data-code-hint]').innerHTML = `Invited by <b>${esc(r.referrer.name)}</b>.`;
    return true;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) { setInvalid(input, true, 'That invitation code isn’t valid. Check it with the member who gave it to you.'); if (focus) input.focus(); return false; }
    return true; /* the backend can't be reached: the code is checked again when the application is submitted */
  }
}

async function submit(btn) {
  const error = $('[data-submit-error]');
  error.hidden = true;
  collect(3);
  if (!validate(3)) return;
  const gap = firstIncomplete();
  if (gap !== undefined) { show(gap); validate(gap); return; }
  const v = state.values;
  busy(btn, true);
  const session = await loadSession(true);
  if (!session.user) {
    busy(btn, false);
    if (session.offline) { error.textContent = `Applications can’t be sent right now because accounts can’t be reached. Everything you entered is saved in this tab; try again in a moment or write to ${SITE.email.support}.`; error.hidden = false; return; }
    /* an account is needed first; the application waits in this tab and picks up where it left off */
    go(href(`/auth/?mode=signup&next=${encodeURIComponent(href('/verify/'))}&ref=${encodeURIComponent(normalize(v.code))}`));
    return;
  }
  const payload = {
    identity: { first: v.first.trim(), last: v.last.trim(), dob: v.dob, country: v.country, idType: state.idtype },
    business: { name: v.business.trim(), registration: v.registration.trim(), registeredIn: v.state.trim(), website: (v.website || '').trim(), industry: v.industry, role: v.role.trim(), authorised: !!v.authorised },
    terms: !!v.terms
  };
  let req;
  try { req = (await api.post('/me/verification', payload)).request; }
  catch (e) {
    busy(btn, false);
    if (e instanceof ApiError && e.code === 'request_open') { error.textContent = `You already have an application in review (reference ${e.details && e.details.reference ? e.details.reference : 'on file'}). Its status is on your dashboard.`; error.hidden = false; return; }
    if (e instanceof ApiError && e.code === 'already_verified') { error.textContent = 'Your profile is already verified. Your stamp is active.'; error.hidden = false; return; }
    error.textContent = e instanceof ApiError && e.status !== 0 && e.status !== 503 ? e.message : 'The application couldn’t be sent right now. Everything you entered is still here; try again in a moment.';
    error.hidden = false; return;
  }
  let docLine = fileObj ? 'Uploaded' : 'Not attached; a reviewer will ask for it by email';
  if (fileObj && req.id) {
    try { await api.put(`/me/verification/${req.id}/documents?kind=identity&name=${encodeURIComponent(fileObj.name)}`, fileObj, { 'content-type': fileObj.type || 'application/octet-stream' }); }
    catch (e) { docLine = e instanceof ApiError && e.code === 'storage_not_configured' ? 'Not stored yet; a reviewer will ask for it by email' : 'Upload failed; a reviewer will ask for it by email'; }
  }
  busy(btn, false);
  const submitted = new Date(req.submittedAt || Date.now());
  const eta = new Date(submitted); let add = SITE.review.businessDays; while (add > 0) { eta.setDate(eta.getDate() + 1); if (eta.getDay() % 6) add--; }
  const rows = [['Reference', req.reference], ['Submitted', fmtDate(submitted.toISOString())], ['Decision expected by', fmtDate(eta.toISOString())], ['Status', 'In review'], ['ID document', docLine]];
  const ledger = $('[data-done-ledger]');
  ledger.innerHTML = rows.map(() => '<li class="ledger__row"><span></span><i></i><b></b></li>').join('');
  ledger.querySelectorAll('.ledger__row').forEach((li, i) => { li.querySelector('span').textContent = rows[i][0]; li.querySelector('b').textContent = rows[i][1]; });
  try { sessionStorage.removeItem(KEY); } catch { /* nothing stored */ }
  show('done');
  stamp(card('done').querySelector('.seal'), { delay: .25, rotate: -8 });
}

function wire() {
  $('[data-industries]').insertAdjacentHTML('beforeend', INDUSTRIES.map((i) => `<option value="${esc(i)}">${esc(i)}</option>`).join(''));
  const dob = $('#v-dob'); dob.max = adultBy; dob.min = '1900-01-01';
  const code = $('#v-code');
  code.addEventListener('input', () => { const pos = code.selectionStart, before = code.value; code.value = before.toUpperCase().replace(/[^A-Z0-9-]/g, ''); if (code.value.length === before.length) code.setSelectionRange(pos, pos); });
  const ref = new URLSearchParams(location.search).get('ref');
  if (ref && !state.values.code) { state.values.code = ref.toUpperCase().replace(/[^A-Z0-9-]/g, ''); save(); }

  const drop = $('[data-drop]'), file = drop.querySelector('[data-file]'), name = drop.querySelector('[data-file-name]');
  const setFile = (f) => {
    if (!f) return;
    fileObj = f;
    drop.classList.add('has-file');
    name.textContent = `${f.name} · ${Math.max(1, Math.round(f.size / 1024))} KB`;
    setInvalid(file, false);
  };
  file.addEventListener('change', () => setFile(file.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));

  cards.forEach((c) => {
    if (c.tagName !== 'FORM') return;
    const i = +c.dataset.step;
    clearOnEdit(c);
    c.addEventListener('change', () => collect(i));
    c.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = c.querySelector('button[type=submit]');
      if (i === 3) { submit(btn); return; }
      collect(i);
      if (!validate(i)) return;
      if (i === 0) { busy(btn, true); const ok = await checkCode(code); busy(btn, false); if (!ok) return; }
      show(i + 1);
    });
    const back = c.querySelector('[data-back]');
    if (back) back.addEventListener('click', () => { collect(i); show(i - 1); });
  });
  $('[data-stage]').addEventListener('click', (e) => { const b = e.target.closest('[data-goto]'); if (b) show(+b.dataset.goto); });
}

boot(async () => {
  wire(); restore();
  const session = await loadSession();
  const m = session.member;
  if (m && (m.status === 'verified' || m.status === 'pending')) {
    const note = document.createElement('p');
    note.className = 'form-note';
    note.innerHTML = m.status === 'verified' ? `Your profile is already verified. <a class="link" href="${href('/dashboard/')}">Open your dashboard</a>` : `Your application is in review. <a class="link" href="${href('/dashboard/')}">See its status</a>`;
    card(0).querySelector('.dossier__card-head').appendChild(note);
  }
  const start = Math.min(state.step || 0, 3);
  show(start === 3 && firstIncomplete() !== undefined ? firstIncomplete() : start, { focus: false });
  if (state.values.code && codeOK(state.values.code)) checkCode($('#v-code'), { focus: false });
});
