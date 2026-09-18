import '../../styles/main.css';
import '../../styles/pages/member.css';
import '../../styles/pages/dashboard.css';
import { boot, gsap, ScrollTrigger, reduced, toast, stamp } from '../main.js';
import { idCard, photo, fmtDate, sealSVG, postHTML, href } from '../ui.js';
import { byId, VOUCHES } from '../../data/members.js';
import { POSTS } from '../../data/feed.js';
import { gaugeHTML, factorsHTML, runGauge } from '../gauge.js';

const m = byId[document.querySelector('[data-dash]').dataset.dash];
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const addYear = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };
const NOW = '2026-09-18';

function build() {
  const h = new Date().getHours();
  document.querySelector('[data-greeting]').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.querySelector('[data-first]').textContent = m.first;
  const renew = fmtDate(addYear(m.verifiedOn));
  document.querySelectorAll('[data-renew]').forEach((el) => (el.textContent = renew));
  document.querySelector('[data-idcard-mount]').innerHTML = idCard(m, { href: false, stamp: true });

  const events = [
    ['Account created', m.joined, 'Profile published to the directory as an unverified member.'],
    ['Documents submitted', addDays(m.joined, 1), 'Passport, business registration and domain details received.'],
    ['Human review started', addDays(m.verifiedOn, -2), 'Assigned to a reviewer. Registry and DNS checks run.'],
    ['Stamp issued', m.verifiedOn, 'Trulinq Verified stamp added to your photo. Score activated.'],
    ['Next re-verification', addYear(m.verifiedOn), 'We check again so stamps never outlive a business.']
  ];
  const tl = document.querySelector('[data-timeline]');
  events.forEach(([title, date, note]) => {
    const cls = date <= NOW ? 'is-done' : 'is-future';
    tl.insertAdjacentHTML('beforeend', `<li class="tl ${cls}" data-tl><span class="tl__title">${title}</span><time class="tl__date" datetime="${date}">${fmtDate(date)}</time><span class="tl__note">${note}</span></li>`);
  });
  const done = [...tl.querySelectorAll('.tl.is-done')]; if (done.length) done[done.length - 1].classList.add('is-now');

  document.querySelector('[data-gauge-mount]').innerHTML = gaugeHTML({ caption: `${m.name} · ${m.company}` });
  document.querySelector('[data-factors-mount]').innerHTML = factorsHTML(m);

  const vouches = VOUCHES[m.id] || [];
  document.querySelector('[data-vouch-count]').textContent = `(${vouches.length})`;
  document.querySelector('[data-vouches]').innerHTML = vouches.map((v, i) => { const f = byId[v.from]; return `<figure class="vouch-card" ><blockquote>${v.text}</blockquote><figcaption><a href="${href(`/members/${f.id}/`)}"><img class="avatar" src="${photo(f.photo, 96)}" alt=""><span><b>${f.name}</b>${f.role}, ${f.company}</span></a><span class="seal seal--sm is-static" data-quiet>${sealSVG()}</span><time datetime="${v.date}">${fmtDate(v.date)}</time></figcaption></figure>`; }).join('') || `<div class="empty"><h3>No endorsements yet.</h3><p>Ask someone you’ve worked with to vouch for you.</p></div>`;
  const posts = POSTS.filter((p) => p.by === m.id);
  document.querySelector('[data-posts]').innerHTML = posts.map((p) => postHTML(p, m)).join('') || `<div class="empty"><h3>No posts yet.</h3><p>The feed is chronological. Your first post goes straight to the top.</p></div>`;

  document.querySelector('[data-letter]').addEventListener('click', () => toast('Your letter is generating; it lands in your inbox in a minute.'));
  document.querySelector('[data-card]').addEventListener('click', () => toast('Card updates are switched off in this preview.'));
  document.querySelectorAll('[data-replace]').forEach((b) => b.addEventListener('click', () => toast(`Replacing your ${b.dataset.replace} starts a fresh review. Switched off in this preview.`)));
  const confirm = document.querySelector('[data-confirm]');
  document.querySelector('[data-cancel]').addEventListener('click', () => { confirm.hidden = false; if (!reduced) gsap.from(confirm, { y: -8, opacity: 0, duration: .5, ease: 'expo.out' }); });
  document.querySelector('[data-confirm-no]').addEventListener('click', () => (confirm.hidden = true));
  document.querySelector('[data-confirm-yes]').addEventListener('click', () => { confirm.hidden = true; toast(`Noted. Your stamp stays active until ${renew}.`); });
}

function hero() {
  const items = document.querySelectorAll('[data-tl]');
  const line = document.querySelector('[data-timeline-line]');
  const doneCount = document.querySelectorAll('.tl.is-done').length;
  if (!reduced) {
    ScrollTrigger.create({ trigger: '[data-timeline]', start: 'top 80%', once: true, onEnter: () => {
      gsap.to(line, { scaleY: Math.min(1, (doneCount - .5) / (items.length - 1)), duration: 1.6, ease: 'power2.inOut' });
      items.forEach((it, i) => gsap.fromTo(it, { x: -14, opacity: 0 }, { x: 0, opacity: 1, duration: .9, ease: 'expo.out', delay: i * .18, clearProps: 'opacity,transform' }));
    } });
    gsap.set(items, { opacity: 0 });
  }
  ScrollTrigger.create({ trigger: '[data-timeline]', start: 'top 80%', once: true, onEnter: () => items.forEach((it, i) => setTimeout(() => it.classList.add('is-seen'), reduced ? 0 : 200 + i * 180)) });

  runGauge(document.querySelector('[data-gauge-root]'), m.factors, { trigger: '#score' });

  const doneItems = document.querySelectorAll('[data-checklist] [data-done]').length, total = document.querySelectorAll('[data-checklist] li').length;
  const pctDone = Math.round((doneItems / total) * 100);
  const fill = document.querySelector('[data-ring-fill]'), num = document.querySelector('[data-ring-num]');
  const st = { v: 0 };
  const paint = () => { fill.style.strokeDashoffset = 100 - st.v; num.textContent = Math.round(st.v) + '%'; };
  if (reduced) { st.v = pctDone; paint(); }
  else ScrollTrigger.create({ trigger: '[data-ring]', start: 'top 90%', once: true, onEnter: () => gsap.to(st, { v: pctDone, duration: 1.6, ease: 'expo.out', onUpdate: paint }) });

  document.querySelectorAll('.rail--jump a').forEach((a) => {
    const sec = document.querySelector(a.getAttribute('href'));
    ScrollTrigger.create({ trigger: sec, start: 'top 45%', end: 'bottom 45%', onToggle: (s) => a.classList.toggle('is-active', s.isActive) });
  });
}

boot(build, hero);
