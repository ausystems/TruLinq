import '../../styles/main.css';
import '../../styles/pages/directory.css';
import { boot, gsap, ScrollTrigger, reduced, hydrateSeals, initStamps, toast, suspend, restore } from '../main.js';
import { Flip } from 'gsap/Flip';
import { idCard, industryPill, INDUSTRY, scoreOf, gradeOf, photo, fmtDate, sealSVG, href } from '../ui.js';
import { MEMBERS, INDUSTRIES } from '../../data/members.js';

gsap.registerPlugin(Flip);

const state = { q: '', industry: 'All', verified: true, sort: 'newest', view: 'cards' };
const grid = document.querySelector('[data-grid]');
const regWrap = document.querySelector('[data-register]');
const regRows = document.querySelector('[data-register-rows]');
const countEl = document.querySelector('[data-count]');
const emptyEl = document.querySelector('[data-empty]');
const resets = document.querySelectorAll('[data-reset]');
let cardEls = new Map(), rowEls = new Map();

function readURL() {
  const u = new URL(location.href);
  state.q = u.searchParams.get('q') || '';
  state.industry = u.searchParams.get('industry') || 'All';
  state.sort = u.searchParams.get('sort') || 'newest';
  state.view = u.searchParams.get('view') || 'cards';
}
function writeURL() {
  const u = new URL(location.href);
  const set = (k, v, def) => (v && v !== def ? u.searchParams.set(k, v) : u.searchParams.delete(k));
  set('q', state.q, ''); set('industry', state.industry, 'All'); set('sort', state.sort, 'newest'); set('view', state.view, 'cards');
  history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);
}

function matches(m) {
  if (state.industry !== 'All' && m.industry !== state.industry) return false;
  if (!state.q) return true;
  const hay = [m.name, m.company, m.city, m.region, m.country, m.industry, m.role, m.offers, m.looking].join(' ').toLowerCase();
  return state.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}
function sorted(list) {
  const l = [...list];
  if (state.sort === 'newest') l.sort((a, b) => b.verifiedOn.localeCompare(a.verifiedOn));
  if (state.sort === 'score') l.sort((a, b) => scoreOf(b.factors) - scoreOf(a.factors));
  if (state.sort === 'az') l.sort((a, b) => a.name.localeCompare(b.name));
  return l;
}

function rowHTML(m) {
  const s = scoreOf(m.factors), g = gradeOf(s);
  return `<a class="reg-row" href="${href(`/members/${m.id}/`)}" data-flip-id="row-${m.id}" data-id="${m.id}">
    <div class="reg-row__who"><img class="avatar" src="${photo(m.photo, 96)}" alt="" loading="lazy"><div><b>${m.name}</b><span>${m.role}</span></div></div>
    <div class="reg-row__cell">${m.company}</div>
    <div class="reg-row__cell">${INDUSTRY[m.industry]?.emoji || ''} ${m.industry}</div>
    <div class="reg-row__cell">${m.city}</div>
    <div class="reg-row__score"><b>${g.grade}</b><span>${s}</span></div>
    <div class="reg-row__date">${fmtDate(m.verifiedOn)}</div>
    <span class="reg-row__go" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg></span>
  </a>`;
}

function buildOnce() {
  grid.innerHTML = MEMBERS.map((m) => idCard(m, { stamp: true }).replace('class="idcard', `data-flip-id="${m.id}" data-id="${m.id}" class="idcard`)).join('');
  regRows.innerHTML = MEMBERS.map(rowHTML).join('');
  grid.querySelectorAll('.idcard').forEach((el) => cardEls.set(el.dataset.id, el));
  regRows.querySelectorAll('.reg-row').forEach((el) => rowEls.set(el.dataset.id, el));
  hydrateSeals(grid);

  const ind = document.querySelector('[data-industries]');
  ind.innerHTML = ['All', ...INDUSTRIES].map((name) => name === 'All'
    ? `<button type="button" class="pill pill--sm" data-industry="All" aria-pressed="true">All industries</button>`
    : `<button type="button" class="pill pill--sm" data-industry="${name}" aria-pressed="false"><span class="emoji" aria-hidden="true">${INDUSTRY[name].emoji}</span>${name}</button>`).join('');

  const faces = document.querySelector('[data-faces]');
  faces.innerHTML = MEMBERS.map((m) => `<span class="face"><img src="${photo(m.photo, 128)}" alt="" loading="lazy"><span class="seal seal--sm is-static" data-quiet>${sealSVG()}</span></span>`).join('');

  document.querySelector('[data-stat="cities"]').textContent = new Set(MEMBERS.map((m) => m.city)).size;
  document.querySelector('[data-stat="industries"]').textContent = new Set(MEMBERS.map((m) => m.industry)).size;
  document.querySelector('[data-stat="people"]').textContent = MEMBERS.length;
}

let first = true;
function render() {
  const list = sorted(MEMBERS.filter(matches));
  const ids = list.map((m) => m.id);
  const container = state.view === 'cards' ? grid : regRows;
  const map = state.view === 'cards' ? cardEls : rowEls;
  const other = state.view === 'cards' ? regWrap : grid;
  const wrap = state.view === 'cards' ? grid : regWrap;
  const animate = !reduced && !first;
  const flipState = animate ? Flip.getState(container.children, { props: 'opacity' }) : null;

  wrap.hidden = false; other.hidden = true;
  map.forEach((el, id) => { el.hidden = !ids.includes(id); });
  ids.forEach((id) => container.appendChild(map.get(id)));

  countEl.textContent = `${list.length} of ${MEMBERS.length} members · ${list.length} verified`;
  emptyEl.hidden = list.length > 0;
  const filtered = state.q || state.industry !== 'All';
  resets.forEach((r) => (r.hidden = !filtered && r.closest('.dir__meta') !== null));
  document.querySelectorAll('[data-industry]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.industry === state.industry)));
  document.querySelectorAll('[data-view-btn]').forEach((b) => { const on = b.dataset.viewBtn === state.view; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
  document.querySelector('[data-sort]').value = state.sort;
  writeURL();

  if (animate) {
    const all = [...container.children];
    suspend(all);
    Flip.from(flipState, { duration: .8, ease: 'expo.out', stagger: .015, absolute: true, scale: true, onComplete: () => restore(all),
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, scale: .9, y: 16 }, { opacity: 1, scale: 1, y: 0, duration: .7, ease: 'expo.out', stagger: .03 }),
      onLeave: (els) => gsap.to(els, { opacity: 0, scale: .92, duration: .35, ease: 'power2.in' }) });
  } else if (!reduced && first) {
    gsap.from(container.querySelectorAll(':scope > :not([hidden])'), { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: .05, delay: .2, clearProps: 'transform,opacity' });
  }
  first = false;
  setTimeout(() => ScrollTrigger.refresh(), 900);
}

function wire() {
  const search = document.querySelector('[data-search]');
  search.value = state.q;
  let t; search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { state.q = search.value.trim(); render(); }, 160); });
  document.addEventListener('keydown', (e) => { if (e.key === '/' && document.activeElement !== search && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) { e.preventDefault(); search.focus(); } });
  document.querySelector('[data-industries]').addEventListener('click', (e) => { const b = e.target.closest('[data-industry]'); if (!b) return; state.industry = b.dataset.industry; render(); });
  document.querySelector('[data-view]').addEventListener('click', (e) => { const b = e.target.closest('[data-view-btn]'); if (!b) return; state.view = b.dataset.viewBtn; render(); });
  document.querySelector('[data-sort]').addEventListener('change', (e) => { state.sort = e.target.value; render(); });
  document.querySelector('[data-verified]').addEventListener('change', (e) => { state.verified = e.target.checked; if (!e.target.checked) toast('Every member here is verified, so the list stays the same.'); });
  resets.forEach((r) => r.addEventListener('click', () => { state.q = ''; state.industry = 'All'; search.value = ''; render(); }));
}

boot(async () => { readURL(); buildOnce(); wire(); }, () => { render(); initStamps(grid); });
