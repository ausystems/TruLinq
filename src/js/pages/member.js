import '../../styles/main.css';
import '../../styles/pages/member.css';
import { boot, busy, toast, setInvalid, clearOnEdit } from '../main.js';
import { idCard, portrait, seal, postHTML, esc, href, scoreOf, gradeOf, fmtDate, isVerified, statusOf } from '../ui.js';
import { gaugeHTML, factorsHTML, runGauge } from '../gauge.js';
import { api, ApiError } from '../api.js';
import { loadMember, loadMembers, loadSession } from '../data.js';
import { SITE } from '../../data/site.js';
import { memberAboutHTML, memberDetails, ledgerHTML } from '../html.js';

const $ = (s) => document.querySelector(s);
const attr = $('[data-member]').dataset.member;
/* static pages carry their slug; the generic page (members/profile/) reads it from the address */
const id = attr === '__dynamic__' ? (location.pathname.match(/\/members\/([a-z0-9-]+)\/?$/) || [])[1] : attr;
let data = null, m = null;

const vouchHTML = (v) => `<figure class="vouch-card"><blockquote>${esc(v.text)}</blockquote><figcaption><a href="${href(`/members/${v.from.id}/`)}">${portrait(v.from, { size: 32, cls: 'avatar' })}<span><b>${esc(v.from.name)}</b>${esc([v.from.role, v.from.company].filter(Boolean).join(', '))}</span></a>${seal({ size: 'xs' })}<time datetime="${esc(v.date)}">${fmtDate(v.date)}</time></figcaption></figure>`;

function notFound() {
  document.title = 'Profile not found · Trulinq';
  $('.mhero__inner').innerHTML = `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="${href('/')}">Trulinq</a><i aria-hidden="true"></i><a href="${href('/directory/')}">Directory</a></nav>
    <div class="mhero__missing"><h1 class="display">This profile isn’t here.</h1><p>No verified member uses this address. The profile may have been renamed, made private, or never existed.</p><a class="btn btn--ink" href="${href('/directory/')}"><span>Search the directory</span></a></div>`;
  document.querySelectorAll('.mscore, .mvouch, .mnext').forEach((s) => (s.hidden = true));
}

async function build() {
  data = id ? await loadMember(id) : null;
  if (!data || !data.member) { notFound(); return; }
  m = data.member;
  const verified = isVerified(m);
  const score = m.score ?? scoreOf(m.factors), g = gradeOf(score);
  const role = [m.role, m.company].filter(Boolean).join(' · ');

  if (attr === '__dynamic__') {
    document.title = `${m.name} · ${verified ? 'Verified on Trulinq' : 'Trulinq'}`;
    const canonical = document.querySelector('link[rel="canonical"]'); if (canonical) canonical.href = `${SITE.url}/members/${m.id}/`;
  }
  $('[data-name]').textContent = m.name;
  $('[data-crumb]').textContent = m.name;
  $('[data-role]').textContent = role;
  const headline = $('[data-headline]');
  if (m.headline && m.headline !== m.company && m.headline !== role) { headline.textContent = m.headline; headline.hidden = false; }
  $('[data-photo]').innerHTML = portrait(m, { size: 360, decorative: false }) + (verified ? seal({ size: 'lg', label: 'Trulinq Verified' }) : '');

  const place = [m.city, m.region].filter(Boolean).join(', ') || m.country;
  $('[data-tags]').innerHTML = [m.industry, place].filter(Boolean).map((t) => `<li class="tag">${esc(t)}</li>`).join('') + `<li class="tag tag--ink">${g.grade} · ${score}</li>` + (verified ? '' : `<li class="tag tag--pending">${esc(statusOf(m).label)}</li>`);
  $('[data-verified-line]').innerHTML = verified ? `${seal({ size: 'xs' })}<span>Verified by the Trulinq review team on <time datetime="${esc(m.verifiedOn)}">${fmtDate(m.verifiedOn)}</time></span>` : '';

  const actions = [];
  actions.push(`<button class="btn btn--primary" type="button" data-endorse><span>Write an endorsement</span></button>`);
  const site = (m.website || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (site) actions.push(`<a class="btn btn--ghost" href="https://${esc(site)}" target="_blank" rel="noopener nofollow"><span>Visit ${esc(site.length > 34 ? site.replace(/\/.*$/, '') : site)}</span></a>`);
  $('[data-actions]').innerHTML = actions.join('');

  /* the same markup scripts/gen-members.mjs writes into the static page, now from the live record */
  $('[data-bio]').innerHTML = memberAboutHTML(m);
  $('[data-details]').innerHTML = ledgerHTML(memberDetails(m, { verified, reverifyMonths: SITE.reverifyMonths }));

  $('[data-gauge-mount]').innerHTML = gaugeHTML({ caption: [m.name, m.company].filter(Boolean).join(' · ') });
  $('[data-factors-mount]').innerHTML = factorsHTML(m);
  $('[data-band-word]').textContent = g.band;
  runGauge($('[data-gauge-root]'), m.factors, { trigger: $('.mscore') });

  const vouches = data.endorsements || [];
  $('[data-vouch-count]').textContent = `(${vouches.length})`;
  $('[data-vouches]').innerHTML = vouches.map(vouchHTML).join('') || `<div class="empty"><h3>No endorsements yet.</h3><p>Worked with ${esc(m.first || m.name)}? Verified members can write one endorsement each, and it stays public.</p><button class="btn btn--ink btn--sm" type="button" data-endorse><span>Write the first one</span></button></div>`;
  const posts = data.posts || [];
  $('[data-posts]').innerHTML = posts.map((p) => postHTML(p, m)).join('') || `<div class="empty"><h3>No posts yet.</h3><p>When ${esc(m.first || m.name)} posts, it appears here and at the top of the chronological feed.</p></div>`;

  const { byId } = await loadMembers();
  const prev = byId[data.prev], next = byId[data.next];
  $('[data-prev]').innerHTML = prev && prev.id !== m.id ? `<span class="mnext__label">Previous member</span>${idCard(prev)}` : '';
  $('[data-next]').innerHTML = next && next.id !== m.id && next !== prev ? `<span class="mnext__label">Next member</span>${idCard(next)}` : '';

  endorsements();
}

/* One endorsement per person, always public: written by verified members, recorded by the server. */
function endorsements() {
  const dialog = $('[data-endorse-dialog]'), form = $('[data-endorse-form]'), text = form.querySelector('textarea');
  const error = $('[data-endorse-error]'), counter = $('[data-endorse-count]');
  $('#endorse-title').textContent = `Endorse ${m.first || m.name}`;
  clearOnEdit(form);
  text.addEventListener('input', () => { counter.textContent = `${text.value.length} of 600`; error.hidden = true; });
  dialog.querySelectorAll('[data-endorse-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  document.addEventListener('click', async (e) => {
    const trigger = e.target.closest('[data-endorse]'); if (!trigger) return;
    const s = await loadSession();
    if (s.offline) { toast('Endorsements can’t be written right now because accounts can’t be reached.'); return; }
    if (!s.user) { location.assign(href(`/auth/?next=${encodeURIComponent(href(`/members/${m.id}/`))}`)); return; }
    if (!s.member || s.member.status !== 'verified') { toast('Only verified members can write endorsements.'); return; }
    if (s.member.id === m.id) { toast('You can’t endorse yourself.'); return; }
    error.hidden = true; dialog.showModal(); text.focus();
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = text.value.trim();
    if (body.length < 10) { setInvalid(text, true); text.focus(); return; }
    const btn = form.querySelector('button[type=submit]');
    busy(btn, true);
    try {
      const { endorsement } = await api.post(`/members/${encodeURIComponent(m.id)}/endorsements`, { body });
      const list = $('[data-vouches]');
      if (list.querySelector('.empty')) list.innerHTML = '';
      list.insertAdjacentHTML('afterbegin', vouchHTML(endorsement));
      $('[data-vouch-count]').textContent = `(${list.querySelectorAll('.vouch-card').length})`;
      text.value = ''; counter.textContent = '0 of 600';
      dialog.close();
      toast('Endorsement published.');
    } catch (err) {
      error.textContent = err instanceof ApiError && err.status !== 0 && err.status !== 503 ? err.message : 'The endorsement couldn’t be saved right now. Your text is still here; try again.';
      error.hidden = false;
    } finally { busy(btn, false); }
  });
}

boot(build);
