import '../../styles/main.css';
import '../../styles/pages/rooms.css';
import { boot, gsap, reduced } from '../main.js';
import { photo, sealSVG, href } from '../ui.js';
import { byId } from '../../data/members.js';
import { ROOMS, roomBySlug } from '../../data/rooms.js';

const index = document.querySelector('[data-index]');
const msgs = document.querySelector('[data-messages]');
const scroller = document.querySelector('[data-room-scroll]');
let current = null, indicator;

const time = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

function buildIndex() {
  index.innerHTML = ROOMS.map((r) => `<a class="room-link" href="#${r.slug}" data-slug="${r.slug}"><span class="room-link__emoji" aria-hidden="true">${r.emoji}</span><span style="display:block"><b>${r.name}</b><span><span class="avatar-stack">${r.members.slice(0, 3).map((id) => `<img class="avatar" src="${photo(byId[id].photo, 48)}" alt="">`).join('')}</span>${r.members.length} members</span></span>${r.live ? '<em>Live</em>' : ''}</a>`).join('') + '<span class="rooms__indicator" aria-hidden="true"></span>';
  indicator = index.querySelector('.rooms__indicator');
  index.addEventListener('click', (e) => { const a = e.target.closest('[data-slug]'); if (!a) return; e.preventDefault(); history.replaceState(null, '', '#' + a.dataset.slug); open(a.dataset.slug); });
}

function open(slug, animate = true) {
  const r = roomBySlug[slug] || ROOMS[0];
  if (current === r.slug) return;
  current = r.slug;
  document.querySelector('[data-room-name]').textContent = `${r.emoji} ${r.name}`;
  document.querySelector('[data-room-topic]').textContent = r.topic;
  const links = [...index.querySelectorAll('[data-slug]')];
  links.forEach((a) => a.classList.toggle('is-active', a.dataset.slug === r.slug));
  const active = links.find((a) => a.dataset.slug === r.slug);
  if (indicator && active && matchMedia('(min-width: 1024px)').matches) {
    const y = active.offsetTop + (active.offsetHeight - 40) / 2;
    if (reduced || indicator.style.opacity !== '1') { gsap.set(indicator, { y, opacity: 1 }); } else gsap.to(indicator, { y, duration: .6, ease: 'expo.out' });
  }
  const sorted = [...r.messages].sort((a, b) => a.at.localeCompare(b.at));
  let prev = null, html = '';
  sorted.forEach((m, i) => {
    const who = byId[m.by]; const cont = prev === m.by; prev = m.by;
    const isNew = i === sorted.length - 1 && r.live;
    html += `<div class="msg ${cont ? 'msg--cont' : ''} ${isNew ? 'msg--new' : ''}" data-msg>
      <img class="avatar" src="${photo(who.photo, 96)}" alt="">
      <div>
        <div class="msg__head"><a class="msg__who" href="${href(`/members/${who.id}/`)}">${who.name}<span class="seal seal--sm is-static" data-quiet aria-label="Verified">${sealSVG()}</span></a><span class="msg__time">${day(m.at)} · ${time(m.at)}</span></div>
        <p class="msg__bubble">${m.text}</p>
      </div>
    </div>`;
  });
  msgs.innerHTML = html;
  const items = msgs.querySelectorAll('[data-msg]');
  if (animate && !reduced) {
    gsap.from(items, { y: 12, opacity: 0, duration: .6, ease: 'expo.out', stagger: .12, clearProps: 'transform,opacity', onUpdate: () => (scroller.scrollTop = scroller.scrollHeight) });
  }
  scroller.scrollTop = scroller.scrollHeight;
  document.title = `${r.name} — Rooms — Trulinq`;
}

boot(async () => { buildIndex(); }, () => {
  open((location.hash || '').slice(1) || ROOMS[0].slug);
  window.addEventListener('hashchange', () => open(location.hash.slice(1)));
});
