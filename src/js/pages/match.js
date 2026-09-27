import '../../styles/main.css';
import '../../styles/pages/match.css';
import { boot } from '../main.js';
import { portrait, seal, esc, href, arrowIcon } from '../ui.js';
import { loadMembers, INDUSTRIES } from '../data.js';

/* Match reads only verified, public members (GET /api/members). */
let MEMBERS = [];
const $ = (s) => document.querySelector(s);
const STOP = new Set(['and', 'the', 'for', 'with', 'that', 'this', 'from', 'your', 'our', 'partners', 'partner', 'companies', 'company', 'services', 'projects', 'general', 'help', 'info', 'experts', 'expert', 'potential', 'business']);
const tokens = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.replace(/s$/, ''));
const overlap = (a, b) => { const A = new Set(tokens(a)); return tokens(b).filter((w) => A.has(w)); };
const state = { offer: '', looking: '', industry: 'All' };

function pairs() {
  const mutual = [], oneway = [];
  for (let i = 0; i < MEMBERS.length; i++) for (let j = i + 1; j < MEMBERS.length; j++) {
    const a = MEMBERS[i], b = MEMBERS[j];
    const ab = overlap(a.offers, b.looking).length, ba = overlap(b.offers, a.looking).length;
    if (ab && ba) mutual.push({ a, b, both: true });
    else if (ab) oneway.push({ a, b });
    else if (ba) oneway.push({ a: b, b: a });
  }
  return { mutual, oneway };
}

const person = (m) => `<a class="fit__person" href="${href(`/members/${m.id}/`)}">${portrait(m, { size: 32 })}${esc(m.first || m.name)}</a>`;
function fitHTML({ a, b, both }) {
  const line = (who, verb, text) => `<div><dt>${esc(who.first || who.name)} ${verb}</dt><dd>${esc(text)}</dd></div>`;
  return `<article class="fit">
    <div class="fit__pair">${person(a)}${person(b)}</div>
    <dl class="fit__lines">${line(a, 'offers', a.offers)}${line(b, 'is looking for', b.looking)}${both ? line(b, 'offers', b.offers) + line(a, 'is looking for', a.looking) : ''}</dl>
  </article>`;
}

/* Highlight the searched words inside text that has already been escaped; only letters and digits are matched, so a
   highlight can never land inside an escaped entity. */
function hi(text, q) {
  let out = esc(text);
  (q || '').toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, '')).filter((w) => w.length > 2).forEach((w) => {
    out = out.replace(new RegExp(`(?<![&#a-z0-9])(${w})`, 'ig'), '<mark>$1</mark>');
  });
  return out;
}
const line = (text, q) => text ? hi(text, q) : '<span class="is-empty">Not listed yet</span>';

function cardHTML(m) {
  const role = [m.role, m.company].filter(Boolean).join(' · ') || m.headline || '';
  const meta = [m.industry, [m.city, m.region].filter(Boolean).join(', ') || m.country].filter(Boolean).join(' · ');
  return `<article class="mcard" data-id="${esc(m.id)}">
    <a class="mcard__photo" href="${href(`/members/${m.id}/`)}" tabindex="-1" aria-hidden="true">${portrait(m, { size: 84 })}${seal({ size: 'sm' })}</a>
    <div>
      <h3 class="mcard__name">${esc(m.name)}</h3>
      ${role ? `<p class="mcard__role">${esc(role)}</p>` : ''}
      ${meta ? `<p class="mcard__meta">${esc(meta)}</p>` : ''}
      <dl class="mcard__lines"><div><dt>Offers</dt><dd data-offers>${line(m.offers)}</dd></div><div><dt>Looking for</dt><dd data-looking>${line(m.looking)}</dd></div></dl>
      <a class="arrow-link" href="${href(`/members/${m.id}/`)}"><span>View ${esc(m.first || 'profile')}’s profile</span><i aria-hidden="true">${arrowIcon()}</i></a>
    </div>
  </article>`;
}

function matches(m) {
  if (state.industry !== 'All' && m.industry !== state.industry) return false;
  const q1 = state.offer.toLowerCase().trim(), q2 = state.looking.toLowerCase().trim();
  const ok1 = !q1 || q1.split(/\s+/).every((w) => [m.offers, m.bio, m.industry, m.headline, m.company].join(' ').toLowerCase().includes(w));
  const ok2 = !q2 || q2.split(/\s+/).every((w) => [m.looking, m.bio].join(' ').toLowerCase().includes(w));
  return ok1 && ok2;
}

function render() {
  let shown = 0;
  document.querySelectorAll('.mcard').forEach((c) => {
    const m = MEMBERS.find((x) => x.id === c.dataset.id);
    const ok = matches(m); c.hidden = !ok; if (ok) shown++;
    c.querySelector('[data-offers]').innerHTML = line(m.offers, state.offer);
    c.querySelector('[data-looking]').innerHTML = line(m.looking, state.looking);
  });
  $('[data-count]').textContent = `${shown} of ${MEMBERS.length} verified member${MEMBERS.length === 1 ? '' : 's'}`;
  $('[data-empty]').hidden = shown > 0;
}

async function build() {
  ({ members: MEMBERS } = await loadMembers());
  $('[data-industry]').insertAdjacentHTML('beforeend', INDUSTRIES.map((i) => `<option value="${esc(i)}">${esc(i)}</option>`).join(''));
  const { mutual, oneway } = pairs();
  $('[data-fits]').innerHTML = mutual.map(fitHTML).join('') || `<div class="empty"><h3>No mutual fits yet.</h3><p>A fit appears when one member offers what another is looking for, in both directions. Add both lines to your profile and you’ll show up here the moment someone matches.</p><a class="btn btn--ink btn--sm" href="${href('/dashboard/#profile')}"><span>Update your profile</span></a></div>`;
  $('[data-oneway]').innerHTML = oneway.slice(0, 6).map(fitHTML).join('');
  $('[data-oneway-wrap]').hidden = !oneway.length;
  $('[data-people]').innerHTML = MEMBERS.map(cardHTML).join('');

  const offer = $('[data-offer]'), looking = $('[data-looking]');
  let t; const onInput = () => { clearTimeout(t); t = setTimeout(() => { state.offer = offer.value; state.looking = looking.value; render(); }, 120); };
  offer.addEventListener('input', onInput); looking.addEventListener('input', onInput);
  $('[data-industry]').addEventListener('change', (e) => { state.industry = e.target.value; render(); });
  $('[data-reset]').addEventListener('click', () => { offer.value = ''; looking.value = ''; state.offer = state.looking = ''; state.industry = 'All'; $('[data-industry]').value = 'All'; render(); offer.focus(); });
  render();
}

boot(build);
