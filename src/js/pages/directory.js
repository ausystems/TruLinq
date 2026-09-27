import '../../styles/main.css';
import '../../styles/pages/directory.css';
import { boot } from '../main.js';
import { idCard, portrait, seal, esc, href, scoreOf, gradeOf, fmtDate, isVerified, statusOf, arrowIcon } from '../ui.js';
import { loadMembers, loadStats, INDUSTRIES } from '../data.js';

/* The list the page shows: verified, public members, or everyone public when "Verified only" is switched off.
   Revoked profiles are never listed. */
let MEMBERS = [];
const state = { q: '', industry: 'All', all: false, sort: 'newest', view: 'cards' };
const $ = (s) => document.querySelector(s);
const grid = $('[data-grid]'), regWrap = $('[data-register]'), regRows = $('[data-register-rows]');
const countEl = $('[data-count]'), emptyEl = $('[data-empty]');

function readURL() {
  const u = new URL(location.href);
  state.q = u.searchParams.get('q') || '';
  const ind = u.searchParams.get('industry') || 'All';
  state.industry = ind === 'All' || INDUSTRIES.includes(ind) ? ind : 'All';
  state.sort = ['newest', 'score', 'az'].includes(u.searchParams.get('sort')) ? u.searchParams.get('sort') : 'newest';
  state.view = u.searchParams.get('view') === 'register' ? 'register' : 'cards';
  state.all = u.searchParams.get('all') === '1';
}
function writeURL() {
  const u = new URL(location.href);
  const set = (k, v, def) => (v && v !== def ? u.searchParams.set(k, v) : u.searchParams.delete(k));
  set('q', state.q, ''); set('industry', state.industry, 'All'); set('sort', state.sort, 'newest'); set('view', state.view, 'cards'); set('all', state.all ? '1' : '', '');
  history.replaceState(null, '', u.pathname + u.search + u.hash);
}

function matches(m) {
  if (state.industry !== 'All' && m.industry !== state.industry) return false;
  if (!state.q) return true;
  const hay = [m.name, m.headline, m.company, m.role, m.city, m.region, m.country, m.industry, m.offers, m.looking].join(' ').toLowerCase();
  return state.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w));
}
const scoreOfM = (m) => m.score ?? scoreOf(m.factors);
function sorted(list) {
  const l = [...list];
  if (state.sort === 'newest') l.sort((a, b) => (b.verifiedOn || '').localeCompare(a.verifiedOn || '') || (b.joined || '').localeCompare(a.joined || '') || a.name.localeCompare(b.name));
  if (state.sort === 'score') l.sort((a, b) => scoreOfM(b) - scoreOfM(a) || a.name.localeCompare(b.name));
  if (state.sort === 'az') l.sort((a, b) => a.name.localeCompare(b.name));
  return l;
}

function rowHTML(m) {
  const s = scoreOfM(m), g = gradeOf(s);
  return `<a class="reg-row" href="${href(`/members/${m.id}/`)}" aria-label="${esc(m.name)}${m.company ? `, ${esc(m.company)}` : ''}${isVerified(m) ? ', Trulinq Verified' : `, ${statusOf(m).label}`}">
    <span class="reg-row__who">${portrait(m, { size: 40, cls: 'avatar' })}<span><b>${esc(m.name)}</b><span>${esc(m.role || m.headline || '')}</span></span></span>
    <span class="reg-row__cell">${esc(m.company || 'Not listed')}</span>
    <span class="reg-row__cell">${esc(m.industry || 'Not listed')}</span>
    <span class="reg-row__cell">${esc(m.city || m.country || 'Not listed')}</span>
    <span class="reg-row__score"><b>${g.grade}</b><span>${s}</span></span>
    <span class="reg-row__date">${isVerified(m) ? fmtDate(m.verifiedOn) : esc(statusOf(m).label)}</span>
    <span class="reg-row__go" aria-hidden="true">${arrowIcon()}</span>
  </a>`;
}

function paintChips() {
  const counts = {};
  MEMBERS.forEach((m) => { if (m.industry) counts[m.industry] = (counts[m.industry] || 0) + 1; });
  $('[data-industries]').innerHTML = ['All', ...INDUSTRIES].map((name) => {
    const n = name === 'All' ? MEMBERS.length : counts[name] || 0;
    return `<button type="button" class="chip" data-industry="${esc(name)}" aria-pressed="${state.industry === name}">${name === 'All' ? 'All industries' : esc(name)} <small>${n}</small></button>`;
  }).join('');
}

function render() {
  const list = sorted(MEMBERS.filter(matches));
  const verified = list.filter(isVerified).length;
  grid.removeAttribute('aria-busy');
  if (state.view === 'cards') { grid.innerHTML = list.map((m) => idCard(m)).join(''); regRows.innerHTML = ''; }
  else { regRows.innerHTML = list.map(rowHTML).join(''); grid.innerHTML = ''; }
  grid.hidden = state.view !== 'cards' || !list.length;
  regWrap.hidden = state.view !== 'register' || !list.length;
  emptyEl.hidden = list.length > 0;
  countEl.textContent = state.all
    ? `${list.length} member${list.length === 1 ? '' : 's'} shown · ${verified} verified`
    : `${list.length} verified member${list.length === 1 ? '' : 's'}${list.length !== MEMBERS.length ? ` of ${MEMBERS.length}` : ''}`;
  $('.dir__meta [data-reset]').hidden = !(state.q || state.industry !== 'All');
  document.querySelectorAll('[data-industry]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.industry === state.industry)));
  document.querySelectorAll('[data-view-btn]').forEach((b) => { const on = b.dataset.viewBtn === state.view; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
  $('[data-sort]').value = state.sort;
  $('[data-verified]').checked = !state.all;
  writeURL();
}

async function load() {
  ({ members: MEMBERS } = await loadMembers({ all: state.all }));
  MEMBERS = MEMBERS.filter((m) => m.status !== 'revoked');
  paintChips();
  $('[data-faces]').innerHTML = MEMBERS.filter(isVerified).map((m) => `<span class="face">${portrait(m, { size: 56 })}${seal({ size: 'xs' })}</span>`).join('');
}

function wire() {
  const search = $('[data-search]');
  search.value = state.q;
  let t;
  search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = search.value.trim(); render(); }, 120); });
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
    const a = document.activeElement;
    if (a && (a.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(a.tagName))) return;
    e.preventDefault(); search.focus();
  });
  $('[data-industries]').addEventListener('click', (e) => { const b = e.target.closest('[data-industry]'); if (!b) return; state.industry = b.dataset.industry; render(); });
  $('[data-view]').addEventListener('click', (e) => { const b = e.target.closest('[data-view-btn]'); if (!b) return; state.view = b.dataset.viewBtn; render(); });
  $('[data-sort]').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  $('[data-verified]').addEventListener('change', async (e) => {
    state.all = !e.target.checked;
    countEl.textContent = 'Loading members…';
    await load(); render();
  });
  document.querySelectorAll('[data-reset]').forEach((r) => r.addEventListener('click', () => { state.q = ''; state.industry = 'All'; search.value = ''; render(); search.focus(); }));
}

boot(async () => {
  readURL();
  await load();
  wire(); render();
  loadStats().then((st) => {
    ['verified', 'industries', 'cities', 'revoked'].forEach((k) => { const el = $(`[data-stat="${k}"]`); if (el && st[k] != null) el.textContent = st[k]; });
  }).catch(() => {});
});
