import '../../styles/main.css';
import '../../styles/pages/match.css';
import { boot, gsap, ScrollTrigger, reduced, suspend, restore } from '../main.js';
import { Flip } from 'gsap/Flip';
import { industryPill, photo, sealSVG, href } from '../ui.js';
import { MEMBERS, INDUSTRIES } from '../../data/members.js';

gsap.registerPlugin(Flip);
const STOP = new Set(['and', 'the', 'for', 'with', 'that', 'this', 'from', 'your', 'our', 'partners', 'partner', 'companies', 'company', 'services', 'projects', 'general', 'help', 'info', 'experts', 'expert', 'potential', 'business']);
const tokens = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.replace(/s$/, ''));
const overlap = (a, b) => { const A = new Set(tokens(a)); return tokens(b).filter((w) => A.has(w)); };

const state = { offer: '', looking: '', industry: 'All' };
let first = true;

function pairs() {
  const mutual = [], oneway = [];
  for (let i = 0; i < MEMBERS.length; i++) for (let j = i + 1; j < MEMBERS.length; j++) {
    const a = MEMBERS[i], b = MEMBERS[j];
    const ab = overlap(a.offers, b.looking), ba = overlap(b.offers, a.looking);
    if (ab.length && ba.length) mutual.push({ a, b, ab, ba });
    else if (ab.length) oneway.push({ a, b, ab, ba: [] });
    else if (ba.length) oneway.push({ a: b, b: a, ab: ba, ba: [] });
  }
  return { mutual, oneway };
}

function fitHTML({ a, b, ab, ba }) {
  return `<article class="fit">
    <div class="fit__pair"><a class="fit__person" href="${href(`/members/${a.id}/`)}"><img src="${photo(a.photo, 72)}" alt="">${a.first}</a><a class="fit__person" href="${href(`/members/${b.id}/`)}"><img src="${photo(b.photo, 72)}" alt="">${b.first}</a><span class="seal seal--sm is-static fit__seal" data-quiet>${sealSVG()}</span></div>
    <div class="fit__lines">
      <div class="fit__line"><b>${a.first} offers</b><i>→</i><em>${a.offers}</em></div>
      <div class="fit__line"><b>${b.first} is looking for</b><i>←</i><em>${b.looking}</em></div>
      ${ba.length ? `<div class="fit__line"><b>${b.first} offers</b><i>→</i><em>${b.offers}</em></div><div class="fit__line"><b>${a.first} is looking for</b><i>←</i><em>${a.looking}</em></div>` : ''}
    </div>
  </article>`;
}

function hi(text, q) { if (!q) return text; const words = q.trim().split(/\s+/).filter((w) => w.length > 2); let out = text; words.forEach((w) => { out = out.replace(new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'), '<mark>$1</mark>'); }); return out; }
function cardHTML(m) {
  return `<article class="mcard" data-id="${m.id}">
    <div class="mcard__photo"><img src="${photo(m.photo, 200)}" alt="${m.name}" loading="lazy"><span class="seal seal--sm is-static" data-quiet>${sealSVG()}</span></div>
    <div>
      <div class="mcard__name">${m.name}</div>
      <div class="mcard__role">${m.role} · ${m.company}</div>
      <div class="mcard__meta">${industryPill(m.industry)}<span class="pill pill--sand pill--sm">${m.city}</span></div>
      <div class="mcard__lines"><div><span>Offers</span><b data-offers>${m.offers}</b></div><div><span>Looking for</span><b data-looking>${m.looking}</b></div></div>
      <a class="arrow-link" href="${href(`/members/${m.id}/`)}">View profile <i><svg viewBox="0 0 16 16"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg></i></a>
    </div>
  </article>`;
}

function matches(m) {
  if (state.industry !== 'All' && m.industry !== state.industry) return false;
  const q1 = state.offer.toLowerCase().trim(), q2 = state.looking.toLowerCase().trim();
  const ok1 = !q1 || q1.split(/\s+/).every((w) => (m.offers + ' ' + m.bio + ' ' + m.industry).toLowerCase().includes(w));
  const ok2 = !q2 || q2.split(/\s+/).every((w) => (m.looking + ' ' + m.bio).toLowerCase().includes(w));
  return ok1 && ok2;
}

function build() {
  document.querySelector('[data-industry]').innerHTML += INDUSTRIES.map((i) => `<option>${i}</option>`).join('');
  const { mutual, oneway } = pairs();
  document.querySelector('[data-fits]').innerHTML = mutual.map(fitHTML).join('') || `<div class="empty"><h3>No mutual fits yet.</h3><p>Add what you offer and what you’re looking for to your profile and they appear here.</p></div>`;
  document.querySelector('[data-oneway]').innerHTML = oneway.slice(0, 6).map(fitHTML).join('');
  document.querySelector('[data-oneway-wrap]').hidden = !oneway.length;
  document.querySelector('[data-people]').innerHTML = MEMBERS.map(cardHTML).join('');
  const offer = document.querySelector('[data-offer]'), looking = document.querySelector('[data-looking]');
  let t; const onInput = () => { clearTimeout(t); t = setTimeout(() => { state.offer = offer.value; state.looking = looking.value; render(); }, 160); };
  offer.addEventListener('input', onInput); looking.addEventListener('input', onInput);
  document.querySelector('[data-industry]').addEventListener('change', (e) => { state.industry = e.target.value; render(); });
  document.querySelector('[data-reset]').addEventListener('click', () => { offer.value = ''; looking.value = ''; state.offer = state.looking = ''; state.industry = 'All'; document.querySelector('[data-industry]').value = 'All'; render(); });
}

function render() {
  const cards = [...document.querySelectorAll('.mcard')];
  const st = !reduced && !first ? Flip.getState(cards) : null;
  let shown = 0;
  cards.forEach((c) => { const m = MEMBERS.find((x) => x.id === c.dataset.id); const ok = matches(m); c.hidden = !ok; if (ok) shown++; c.querySelector('[data-offers]').innerHTML = hi(m.offers, state.offer); c.querySelector('[data-looking]').innerHTML = hi(m.looking, state.looking); });
  document.querySelector('[data-count]').textContent = `${shown} of ${MEMBERS.length} verified members`;
  document.querySelector('[data-empty]').hidden = shown > 0;
  if (st) { suspend(cards); Flip.from(st, { duration: .7, ease: 'expo.out', stagger: .02, absolute: true, onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .6 }), onLeave: (els) => gsap.to(els, { opacity: 0, duration: .3 }), onComplete: () => restore(cards) }); }
  first = false;
  setTimeout(() => ScrollTrigger.refresh(), 800);
}

function hero() {
  render();
  if (reduced) { gsap.set('.xsearch__link', { scaleX: 1 }); return; }
  gsap.timeline({ delay: .3 })
    .from('.xsearch__field--a', { x: -40, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0)
    .from('.xsearch__field--b', { x: 40, opacity: 0, duration: 1.1, ease: 'expo.out' }, 0)
    .to('.xsearch__link', { scaleX: 1, duration: .6, ease: 'expo.out' }, .5);
  gsap.from('.fit', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: '[data-fits]', start: 'top 85%', once: true }, clearProps: 'transform,opacity' });
  gsap.from('.mcard', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: .05, scrollTrigger: { trigger: '[data-people]', start: 'top 85%', once: true }, clearProps: 'transform,opacity' });
}

boot(build, hero);
