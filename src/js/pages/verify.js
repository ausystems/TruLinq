import '../../styles/main.css';
import '../../styles/pages/verify.css';
import { boot, gsap, ScrollTrigger, reduced, stamp, toast, scrollTo } from '../main.js';
import { INDUSTRIES } from '../../data/members.js';

const KEY = 'tq-verify';
const state = JSON.parse(sessionStorage.getItem(KEY) || '{"step":0,"values":{},"idtype":"Passport","file":""}');
const save = () => sessionStorage.setItem(KEY, JSON.stringify(state));

const stage = document.querySelector('[data-stage]');
const cards = [...stage.querySelectorAll('[data-step]')];
const stepItems = document.querySelectorAll('[data-step-item]');
const arcs = document.querySelectorAll('[data-arc]');
const stepNum = document.querySelector('[data-step-num]');
const check = document.querySelector('.dossier__check');

function card(i) { return cards.find((c) => c.dataset.step === String(i)); }

function fmtCode(v) {
  const raw = v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^TL/, '').slice(0, 8);
  let out = 'TL';
  if (raw.length) out += '-' + raw.slice(0, 4);
  if (raw.length > 4) out += '-' + raw.slice(4, 8);
  return out;
}

function setInvalid(field, bad) { field.classList.toggle('is-invalid', bad); }
function validate(i) {
  const c = card(i); let ok = true;
  const req = (sel, test = (v) => v.trim().length > 1) => { const el = c.querySelector(sel); const bad = !test(el.value || ''); setInvalid(el.closest('.field'), bad); if (bad && ok) { el.focus(); } ok = ok && !bad; };
  if (i === 0) req('#v-code', (v) => /^TL-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(v));
  if (i === 1) {
    req('#v-first'); req('#v-last');
    req('#v-dob', (v) => v && new Date(v) <= new Date('2008-09-18'));
    req('#v-country', (v) => v.length > 0);
    const f = c.querySelector('[data-file]'); const bad = !state.file; setInvalid(f.closest('.field'), bad); ok = ok && !bad;
  }
  if (i === 2) {
    req('#v-biz'); req('#v-reg', (v) => v.trim().length > 3); req('#v-state');
    req('#v-site', (v) => !v.trim() || /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(v.trim()));
    req('#v-ind', (v) => v.length > 0); req('#v-role');
    const a = c.querySelector('[data-auth]'); const bad = !a.checked; setInvalid(a.closest('.field'), bad); ok = ok && !bad;
  }
  if (i === 3) { const t = c.querySelector('[data-terms]'); const bad = !t.checked; setInvalid(t.closest('.field'), bad); ok = ok && !bad; }
  return ok;
}

function collect(i) {
  card(i).querySelectorAll('input[name], select[name]').forEach((el) => { state.values[el.name] = el.type === 'checkbox' ? el.checked : el.value; });
  save();
}
function restore() {
  cards.forEach((c) => c.querySelectorAll('input[name], select[name]').forEach((el) => { if (state.values[el.name] === undefined) return; if (el.type === 'checkbox') el.checked = !!state.values[el.name]; else el.value = state.values[el.name]; }));
  if (state.file) { const n = document.querySelector('[data-file-name]'); n.hidden = false; n.textContent = state.file; }
  document.querySelectorAll('[data-idtype-btn]').forEach((b) => { const on = b.dataset.idtypeBtn === state.idtype; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
}

function summary() {
  const v = state.values;
  const rows = [
    ['Invitation', v.code, 0], ['Name', `${v.first || ''} ${v.last || ''}`.trim(), 1], ['ID', `${state.idtype} · ${v.country || ''}`, 1], ['Document', state.file, 1],
    ['Business', v.business, 2], ['Registration', `${v.registration || ''} · ${v.state || ''}`, 2], ['Website', v.website || 'none yet', 2], ['Industry', v.industry, 2], ['Role', v.role, 2]
  ];
  document.querySelector('[data-summary]').innerHTML = rows.map(([k, val, s]) => `<li class="ledger__row"><span>${k}</span><i></i><b>${val || '—'} <a href="#" data-goto="${s}">Edit</a></b></li>`).join('');
}

function paint(i) {
  stepItems.forEach((li, j) => { li.toggleAttribute('aria-current', j === i); li.classList.toggle('is-done', j < i); });
  arcs.forEach((a, j) => a.classList.toggle('is-done', j < i));
  stepNum.textContent = Math.min(i + 1, 4);
}

let current = state.step;
function go(next, dir = 1) {
  if (next === current && card(next) && !card(next).hidden) return;
  const from = card(current), to = card(next);
  if (next === 3) summary();
  const show = () => {
    to.hidden = false;
    const first = to.querySelector('input:not([disabled]):not([type=file]), select, button');
    if (reduced) { paint(next); first && first.focus({ preventScroll: true }); return; }
    gsap.fromTo(to, { y: 40 * dir, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'expo.out', clearProps: 'transform', onComplete: () => first && first.focus({ preventScroll: true }) });
    paint(next);
  };
  if (from && !from.hidden && !reduced) gsap.to(from, { y: -30 * dir, opacity: 0, duration: .4, ease: 'power2.in', onComplete: () => { from.hidden = true; gsap.set(from, { clearProps: 'all' }); show(); } });
  else { if (from) from.hidden = true; show(); }
  current = next; state.step = typeof next === 'number' ? next : 3; save();
  if (window.scrollY > stage.getBoundingClientRect().top + window.scrollY - 120) scrollTo(stage, { offset: -110 });
}

function finish() {
  collect(3);
  const ref = 'TQ-2026-0918-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  const now = new Date();
  const eta = new Date(now); let add = 2; while (add > 0) { eta.setDate(eta.getDate() + 1); if (eta.getDay() % 6) add--; }
  const fmt = (d) => d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  document.querySelector('[data-done-ledger]').innerHTML = [
    ['Reference no.', ref], ['Submitted', fmt(now)], ['Estimated decision', fmt(eta)], ['Status', 'In review']
  ].map(([k, v]) => `<li class="ledger__row"><span>${k}</span><i></i><b>${v}</b></li>`).join('');
  const done = card('done');
  const from = card(3);
  const reveal = () => {
    from.hidden = true; done.hidden = false;
    paint(4); arcs.forEach((a) => a.classList.add('is-done'));
    if (reduced) { done.querySelector('.seal').classList.add('is-stamped'); gsap.set(check, { strokeDashoffset: 0 }); gsap.set('.dossier__progress-num', { opacity: 0 }); return; }
    gsap.fromTo(done, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'expo.out', clearProps: 'transform' });
    stamp(done.querySelector('.seal'), { delay: .5, rotate: -8 });
    gsap.to(check, { strokeDashoffset: 0, duration: .8, ease: 'power2.inOut', delay: .3 });
    gsap.to('.dossier__progress-num', { opacity: 0, duration: .3, delay: .3 });
  };
  if (reduced) reveal(); else gsap.to(from, { y: -30, opacity: 0, duration: .4, ease: 'power2.in', onComplete: reveal });
  sessionStorage.removeItem(KEY);
  toast('Application received. Reference ' + ref);
}

function wire() {
  document.querySelector('[data-industries]').innerHTML += INDUSTRIES.map((i) => `<option>${i}</option>`).join('');
  const code = document.querySelector('#v-code');
  code.addEventListener('input', () => { const pos = code.selectionStart; code.value = fmtCode(code.value); });
  code.addEventListener('focus', () => { if (!code.value) code.value = 'TL-'; });
  document.querySelector('[data-google]').addEventListener('click', () => toast('Google sign-in is switched off in this preview.'));
  document.querySelectorAll('[data-idtype-btn]').forEach((b) => b.addEventListener('click', () => { state.idtype = b.dataset.idtypeBtn; save(); restore(); }));
  const drop = document.querySelector('[data-drop]'), file = drop.querySelector('[data-file]'), name = drop.querySelector('[data-file-name]');
  const setFile = (f) => { if (!f) return; state.file = f.name; save(); name.hidden = false; name.textContent = f.name + ' · ' + Math.max(1, Math.round(f.size / 1024)) + ' KB'; setInvalid(drop.closest('.field'), false); };
  file.addEventListener('change', () => setFile(file.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => setFile(e.dataTransfer.files[0]));
  cards.forEach((c) => {
    if (c.tagName !== 'FORM') return;
    const i = +c.dataset.step;
    c.addEventListener('submit', (e) => { e.preventDefault(); if (!validate(i)) return; collect(i); if (i === 3) finish(); else go(i + 1, 1); });
    c.querySelectorAll('.input, select').forEach((el) => el.addEventListener('input', () => setInvalid(el.closest('.field'), false)));
    c.querySelectorAll('input[type=checkbox]').forEach((el) => el.addEventListener('change', () => setInvalid(el.closest('.field'), false)));
    const back = c.querySelector('[data-back]'); back && back.addEventListener('click', () => { collect(i); go(i - 1, -1); });
  });
  stage.addEventListener('click', (e) => { const a = e.target.closest('[data-goto]'); if (!a) return; e.preventDefault(); go(+a.dataset.goto, -1); });
}

boot(async () => { wire(); restore(); }, () => {
  cards.forEach((c) => (c.hidden = true));
  const c = card(state.step) || card(0); c.hidden = false; paint(state.step); current = state.step;
  if (!reduced) gsap.from(c, { y: 40, opacity: 0, duration: 1, ease: 'expo.out', delay: .2, clearProps: 'transform' });
  if (!reduced) gsap.from('.dossier__progress', { scale: .8, opacity: 0, duration: 1, ease: 'back.out(1.6)', delay: .1 });
});
