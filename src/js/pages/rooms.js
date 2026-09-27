import '../../styles/main.css';
import '../../styles/pages/rooms.css';
import { boot, gsap, reduced, toast, hydrateSeals } from '../main.js';
import { photo, sealSVG, href } from '../ui.js';
import { api, ApiError } from '../api.js';
import { loadRooms, loadRoomMessages, loadSession } from '../data.js';

const index = document.querySelector('[data-index]');
const msgs = document.querySelector('[data-messages]');
const scroller = document.querySelector('[data-room-scroll]');
let ROOMS = [], roomBySlug = {}, session = { user: null, member: null };
let current = null, currentRoom = null, indicator;

const time = (iso) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
const day = (iso) => new Date(iso).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

function buildIndex() {
  index.innerHTML = ROOMS.map((r) => `<a class="room-link" href="#${r.slug}" data-slug="${r.slug}"><span class="room-link__emoji" aria-hidden="true">${r.emoji}</span><span style="display:block"><b>${r.name}</b><span><span class="avatar-stack">${r.members.slice(0, 3).map((m) => `<img class="avatar" src="${photo(m.photo, 48)}" alt="">`).join('')}</span>${r.memberCount} members</span></span>${r.live ? '<em>Live</em>' : ''}</a>`).join('') + '<span class="rooms__indicator" aria-hidden="true"></span>';
  indicator = index.querySelector('.rooms__indicator');
  index.addEventListener('click', (e) => { const a = e.target.closest('[data-slug]'); if (!a) return; e.preventDefault(); history.replaceState(null, '', '#' + a.dataset.slug); open(a.dataset.slug); });
}

function messageHTML(m, cont, isNew) {
  const who = m.author;
  return `<div class="msg ${cont ? 'msg--cont' : ''} ${isNew ? 'msg--new' : ''}" data-msg>
      <img class="avatar" src="${photo(who.photo, 96)}" alt="">
      <div>
        <div class="msg__head"><a class="msg__who" href="${href(`/members/${who.id}/`)}">${who.name}<span class="seal seal--sm is-static" data-quiet aria-label="Verified">${sealSVG()}</span></a><span class="msg__time">${day(m.at)} · ${time(m.at)}</span></div>
        <p class="msg__bubble">${m.text}</p>
      </div>
    </div>`;
}

async function open(slug, animate = true) {
  const r = roomBySlug[slug] || ROOMS[0];
  if (!r || current === r.slug) return;
  current = r.slug; currentRoom = r;
  document.querySelector('[data-room-name]').textContent = `${r.emoji} ${r.name}`;
  document.querySelector('[data-room-topic]').textContent = r.topic;
  const links = [...index.querySelectorAll('[data-slug]')];
  links.forEach((a) => a.classList.toggle('is-active', a.dataset.slug === r.slug));
  const active = links.find((a) => a.dataset.slug === r.slug);
  if (indicator && active && matchMedia('(min-width: 1024px)').matches) {
    const y = active.offsetTop + (active.offsetHeight - 40) / 2;
    if (reduced || indicator.style.opacity !== '1') { gsap.set(indicator, { y, opacity: 1 }); } else gsap.to(indicator, { y, duration: .6, ease: 'expo.out' });
  }
  let messages = [];
  try { messages = await loadRoomMessages(r); } catch (e) { toast('Messages could not be loaded.'); }
  if (current !== r.slug) return;
  const sorted = [...messages].sort((a, b) => a.at.localeCompare(b.at));
  let prev = null, html = '';
  sorted.forEach((m, i) => { const cont = prev === m.by; prev = m.by; html += messageHTML(m, cont, i === sorted.length - 1 && r.live); });
  msgs.innerHTML = html;
  const items = msgs.querySelectorAll('[data-msg]');
  if (animate && !reduced) {
    gsap.from(items, { y: 12, opacity: 0, duration: .6, ease: 'expo.out', stagger: .12, clearProps: 'transform,opacity', onUpdate: () => (scroller.scrollTop = scroller.scrollHeight) });
  }
  scroller.scrollTop = scroller.scrollHeight;
  document.title = `${r.name} — Rooms — Trulinq`;
}

/* Verified members can speak; the composer becomes a real one. Everyone else keeps the read-only room. */
function composer() {
  const box = document.querySelector('.room__composer');
  const input = box.querySelector('.room__input'), cta = box.querySelector('.btn');
  const m = session.member;
  if (!m || m.status !== 'verified') { if (m && m.status === 'pending') cta.querySelector('span').textContent = 'Verification in review'; return; }
  input.disabled = false; input.placeholder = 'Say something to the room';
  cta.href = '#'; cta.querySelector('span').textContent = 'Send';
  const send = async () => {
    const body = input.value.trim();
    if (!body || !currentRoom) { input.focus(); return; }
    input.disabled = true;
    try {
      const { message } = await api.post(`/rooms/${encodeURIComponent(currentRoom.slug)}/messages`, { body });
      const last = msgs.querySelector('[data-msg]:last-child');
      msgs.querySelectorAll('.msg--new').forEach((el) => el.classList.remove('msg--new'));
      const prevBy = last ? last.querySelector('.msg__who')?.getAttribute('href') : null;
      msgs.insertAdjacentHTML('beforeend', messageHTML(message, prevBy === href(`/members/${message.by}/`), true));
      hydrateSeals(msgs);
      if (currentRoom._messages) currentRoom._messages.push(message);
      input.value = '';
      scroller.scrollTop = scroller.scrollHeight;
    } catch (e) { toast(e instanceof ApiError ? e.message : 'The message could not be sent.'); }
    finally { input.disabled = false; input.focus(); }
  };
  cta.addEventListener('click', (e) => { e.preventDefault(); send(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } });
}

boot(async () => {
  [ROOMS, session] = await Promise.all([loadRooms(), loadSession()]);
  roomBySlug = Object.fromEntries(ROOMS.map((r) => [r.slug, r]));
  buildIndex(); composer();
}, () => {
  if (!ROOMS.length) return;
  open((location.hash || '').slice(1) || ROOMS[0].slug);
  window.addEventListener('hashchange', () => open(location.hash.slice(1)));
});
