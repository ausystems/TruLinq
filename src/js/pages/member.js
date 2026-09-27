import '../../styles/main.css';
import '../../styles/pages/member.css';
import { boot, gsap, stamp, reduced, hydrateSeals, initStamps, toast, popIn } from '../main.js';
import { idCard, industryPill, photo, scoreOf, gradeOf, fmtDate, sealSVG, postHTML, href } from '../ui.js';
import { gaugeHTML, factorsHTML, runGauge } from '../gauge.js';
import { api, ApiError } from '../api.js';
import { loadMember, loadMembers, loadSession } from '../data.js';

const attr = document.querySelector('[data-member]').dataset.member;
/* static pages carry their slug; the generic page (members/profile/) reads it from the address */
const id = attr === '__dynamic__' ? (location.pathname.match(/\/members\/([a-z0-9-]+)\/?/) || [])[1] : attr;
let data = null, m = null;

async function build() {
  data = id ? await loadMember(id) : null;
  if (!data || !data.member) { location.replace(href('/directory/')); return; }
  m = data.member;
  const verified = m.status === 'verified';
  const score = m.score ?? scoreOf(m.factors), g = gradeOf(score);

  if (attr === '__dynamic__') {
    document.title = `${m.name} — ${verified ? 'Verified on Trulinq' : 'Trulinq'}`;
    document.querySelector('.mhero__id h1').textContent = m.name;
    document.querySelector('.mhero__role').textContent = `${m.role || 'Member'} · ${m.company || 'No business yet'}`;
    document.querySelector('.mhero__bio').textContent = m.bio;
    const crumb = document.querySelector('.breadcrumb span'); if (crumb) crumb.textContent = m.name;
    const connect = document.querySelector('.mhero__actions a.btn--primary'); if (connect) connect.href = href(`/auth/?next=${encodeURIComponent(`/members/${m.id}/`)}`);
  }
  const img = document.querySelector('[data-photo-img]');
  img.src = photo(m.photo, 800); img.alt = m.name;
  img.srcset = `${photo(m.photo, 480)} 480w, ${photo(m.photo, 800)} 800w, ${photo(m.photo, 1200)} 1200w`;
  img.sizes = '(min-width: 900px) 400px, 90vw';
  if (!verified) document.querySelector('.mhero__seal')?.remove();

  document.querySelector('[data-pills]').innerHTML = (m.industry ? industryPill(m.industry) : '') + `<span class="pill pill--sand pill--sm">${[m.city, m.region].filter(Boolean).join(', ') || 'Location not set'}</span><span class="pill pill--sm pill--ink mono">${g.grade} · ${score}</span>`;
  document.querySelector('[data-verified-line]').innerHTML = verified ? `Verified on <b>${fmtDate(m.verifiedOn)}</b> by the Trulinq review team` : m.status === 'pending' ? 'Verification <b>in review</b>' : 'Not yet <b>verified</b>';
  document.querySelector('[data-social]').textContent = `${m.followers} followers · ${m.following} following`;
  document.querySelector('[data-details]').innerHTML = [
    ['Industry', m.industry || '—'], ['Location', [m.city, m.country].filter(Boolean).join(', ') || '—'], ['Founded', m.founded || '—'],
    ['Website', m.website ? `<a href="https://${m.website}" target="_blank" rel="noopener">${m.website}</a>` : '—'],
    ['Member since', fmtDate(m.joined)], ['Re-verification due', verified ? fmtDate(nextYear(m.verifiedOn)) : '—']
  ].map(([k, v]) => `<li class="ledger__row"><span>${k}</span><i></i><b>${v}</b></li>`).join('');

  document.querySelector('[data-gauge-mount]').innerHTML = gaugeHTML({ caption: `${m.name} · ${m.company || 'No business yet'}` });
  document.querySelector('[data-factors-mount]').innerHTML = factorsHTML(m);
  document.querySelector('[data-band-word]').textContent = g.band;

  const vouches = data.endorsements || [];
  document.querySelector('[data-vouch-count]').textContent = `(${vouches.length})`;
  document.querySelector('[data-vouches]').innerHTML = vouches.length ? vouches.map((v) => `<figure class="vouch-card">
      <blockquote>${v.text}</blockquote>
      <figcaption><a href="${href(`/members/${v.from.id}/`)}"><img class="avatar" src="${photo(v.from.photo, 96)}" alt=""><span><b>${v.from.name}</b>${v.from.role}, ${v.from.company}</span></a><span class="seal seal--sm is-static" data-quiet>${sealSVG()}</span><time datetime="${v.date}">${fmtDate(v.date)}</time></figcaption>
    </figure>`).join('') : `<div class="empty"><h3>No endorsements yet.</h3><p>Worked with ${m.first}? Members can write one vouch each, and it stays public.</p><button class="btn btn--ink btn--sm" type="button" data-endorse><span>Write the first one</span></button></div>`;

  const posts = data.posts || [];
  document.querySelector('[data-posts]').innerHTML = posts.length ? posts.map((p) => postHTML(p, m)).join('') : `<div class="empty"><h3>No posts yet.</h3><p>${m.first} reads the feed but hasn’t posted. The feed is chronological, so the first post will show up at the top.</p></div>`;

  const { byId } = await loadMembers();
  const prev = byId[data.prev], next = byId[data.next];
  const prevEl = document.querySelector('[data-prev]'), nextEl = document.querySelector('[data-next]');
  if (prev) prevEl.innerHTML = `<span class="tag">← Previous verified member</span>${idCard(prev)}`; else prevEl.hidden = true;
  nextEl.classList.add('mnext__col--next');
  if (next) nextEl.innerHTML = `<span class="tag">Next verified member →</span>${idCard(next)}`; else nextEl.hidden = true;

  document.querySelectorAll('[data-endorse]').forEach((b) => b.addEventListener('click', endorse));
}

function nextYear(iso) { const d = new Date(iso + 'T12:00:00'); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); }

/* One vouch per person, always public: written by verified members only, recorded by the server. */
async function endorse() {
  const s = await loadSession();
  if (!s.user) { toast(`Sign in to endorse ${m.first}. One vouch per person, always public.`); return; }
  if (!s.member || s.member.status !== 'verified') { toast('Only verified members can write endorsements.'); return; }
  if (s.member.id === m.id) { toast('You cannot endorse yourself.'); return; }
  const text = window.prompt(`Your endorsement of ${m.name} (10 to 600 characters). It is public and cannot be edited later.`);
  if (text === null) return;
  try {
    const r = await api.post(`/members/${encodeURIComponent(m.id)}/endorsements`, { body: text.trim() });
    const v = r.endorsement;
    const list = document.querySelector('[data-vouches]');
    if (list.querySelector('.empty')) list.innerHTML = '';
    list.insertAdjacentHTML('afterbegin', `<figure class="vouch-card"><blockquote>${v.text}</blockquote><figcaption><a href="${href(`/members/${v.from.id}/`)}"><img class="avatar" src="${photo(v.from.photo, 96)}" alt=""><span><b>${v.from.name}</b>${v.from.role}, ${v.from.company}</span></a><span class="seal seal--sm is-static" data-quiet>${sealSVG()}</span><time datetime="${v.date}">${fmtDate(v.date)}</time></figcaption></figure>`);
    hydrateSeals(list);
    document.querySelector('[data-vouch-count]').textContent = `(${list.querySelectorAll('.vouch-card').length})`;
    toast('Endorsement published.');
  } catch (e) { toast(e instanceof ApiError ? e.message : 'The endorsement could not be saved.'); }
}

function hero() {
  if (!m) return;
  const img = document.querySelector('[data-photo-img]');
  const seal = document.querySelector('.mhero__seal');
  if (reduced) { seal && seal.classList.add('is-stamped'); return; }
  gsap.timeline()
    .to(img, { clipPath: 'inset(0% 0 0 0 round 32px)', duration: 1.3, ease: 'expo.out' }, 0)
    .add(() => seal && stamp(seal, { rotate: -8 }), 1.0);
  popIn(document.querySelectorAll('[data-pills] .pill'), { delay: .5, stagger: { each: .08 } });
  runGauge(document.querySelector('[data-gauge-root]'), m.factors, { trigger: '.mscore' });
  initStamps(document.querySelector('.mnext'));
}

boot(build, hero);
