import '../../styles/main.css';
import '../../styles/pages/member.css';
import { boot, gsap, stamp, reduced, hydrateSeals, initStamps, toast, popIn } from '../main.js';
import { idCard, industryPill, photo, scoreOf, gradeOf, fmtDate, sealSVG, postHTML, href } from '../ui.js';
import { MEMBERS, byId, VOUCHES } from '../../data/members.js';
import { POSTS } from '../../data/feed.js';
import { gaugeHTML, factorsHTML, runGauge } from '../gauge.js';

const id = document.querySelector('[data-member]').dataset.member;
const m = byId[id];

function build() {
  if (!m) { location.replace(href('/directory/')); return; }
  const score = scoreOf(m.factors), g = gradeOf(score);

  const img = document.querySelector('[data-photo-img]');
  img.src = photo(m.photo, 800);
  img.srcset = `${photo(m.photo, 480)} 480w, ${photo(m.photo, 800)} 800w, ${photo(m.photo, 1200)} 1200w`;
  img.sizes = '(min-width: 900px) 400px, 90vw';

  document.querySelector('[data-pills]').innerHTML = industryPill(m.industry) + `<span class="pill pill--sand pill--sm">${m.city}, ${m.region}</span><span class="pill pill--sm pill--ink mono">${g.grade} · ${score}</span>`;
  document.querySelector('[data-verified-line]').innerHTML = `Verified on <b>${fmtDate(m.verifiedOn)}</b> by the Trulinq review team`;
  document.querySelector('[data-social]').textContent = `${m.followers} followers · ${m.following} following`;
  document.querySelector('[data-details]').innerHTML = [
    ['Industry', m.industry], ['Location', `${m.city}, ${m.country}`], ['Founded', m.founded || '—'],
    ['Website', m.website ? `<a href="https://${m.website}" target="_blank" rel="noopener">${m.website}</a>` : '—'],
    ['Member since', fmtDate(m.joined)], ['Re-verification due', fmtDate(nextYear(m.verifiedOn))]
  ].map(([k, v]) => `<li class="ledger__row"><span>${k}</span><i></i><b>${v}</b></li>`).join('');

  document.querySelector('[data-gauge-mount]').innerHTML = gaugeHTML({ caption: `${m.name} · ${m.company}` });
  document.querySelector('[data-factors-mount]').innerHTML = factorsHTML(m);
  document.querySelector('[data-band-word]').textContent = g.band;

  const vouches = VOUCHES[m.id] || [];
  document.querySelector('[data-vouch-count]').textContent = `(${vouches.length})`;
  const vEl = document.querySelector('[data-vouches]');
  vEl.innerHTML = vouches.length ? vouches.map((v, i) => {
    const f = byId[v.from];
    return `<figure class="vouch-card" >
      <blockquote>${v.text}</blockquote>
      <figcaption><a href="${href(`/members/${f.id}/`)}"><img class="avatar" src="${photo(f.photo, 96)}" alt=""><span><b>${f.name}</b>${f.role}, ${f.company}</span></a><span class="seal seal--sm is-static" data-quiet>${sealSVG()}</span><time datetime="${v.date}">${fmtDate(v.date)}</time></figcaption>
    </figure>`;
  }).join('') : `<div class="empty"><h3>No endorsements yet.</h3><p>Worked with ${m.first}? Members can write one vouch each, and it stays public.</p><button class="btn btn--ink btn--sm" type="button" data-endorse><span>Write the first one</span></button></div>`;

  const posts = POSTS.filter((p) => p.by === m.id);
  document.querySelector('[data-posts]').innerHTML = posts.length ? posts.map((p) => postHTML(p, m)).join('') : `<div class="empty"><h3>No posts yet.</h3><p>${m.first} reads the feed but hasn’t posted. The feed is chronological, so the first post will show up at the top.</p></div>`;

  const i = MEMBERS.findIndex((x) => x.id === m.id), n = MEMBERS.length;
  const prev = MEMBERS[(i - 1 + n) % n], next = MEMBERS[(i + 1) % n];
  document.querySelector('[data-prev]').innerHTML = `<span class="tag">← Previous verified member</span>${idCard(prev)}`;
  const nx = document.querySelector('[data-next]'); nx.classList.add('mnext__col--next');
  nx.innerHTML = `<span class="tag">Next verified member →</span>${idCard(next)}`;

  document.querySelectorAll('[data-endorse]').forEach((b) => b.addEventListener('click', () => toast(`Sign in to endorse ${m.first}. One vouch per person, always public.`)));
}

function nextYear(iso) { const d = new Date(iso + 'T12:00:00'); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); }

function hero() {
  const img = document.querySelector('[data-photo-img]');
  const seal = document.querySelector('.mhero__seal');
  if (reduced) { seal.classList.add('is-stamped'); return; }
  gsap.timeline()
    .to(img, { clipPath: 'inset(0% 0 0 0 round 32px)', duration: 1.3, ease: 'expo.out' }, 0)
    .add(() => stamp(seal, { rotate: -8 }), 1.0);
  popIn(document.querySelectorAll('[data-pills] .pill'), { delay: .5, stagger: { each: .08 } });
  runGauge(document.querySelector('[data-gauge-root]'), m.factors, { trigger: '.mscore' });
  initStamps(document.querySelector('.mnext'));
}

boot(build, hero);
