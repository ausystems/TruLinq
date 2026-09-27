import '../../styles/main.css';
import '../../styles/pages/rooms.css';
import { boot, busy, toast } from '../main.js';
import { portrait, seal, esc, href, relTime } from '../ui.js';
import { api, ApiError } from '../api.js';
import { loadRooms, loadRoomMessages, loadSession } from '../data.js';

const $ = (s) => document.querySelector(s);
const index = $('[data-index]'), msgs = $('[data-messages]'), scroller = $('[data-room-scroll]');
let ROOMS = [], bySlug = {}, session = { user: null, member: null }, current = null;

const stamp = (iso) => new Date(iso).toLocaleString('en-US', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const activity = (r) => [r.lastMessageAt ? `Last message ${relTime(r.lastMessageAt)}` : 'No messages yet', r.memberCount ? `${r.memberCount} member${r.memberCount === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ');

function buildIndex() {
  index.innerHTML = ROOMS.map((r) => `<a class="room-link" href="#${esc(r.slug)}" data-slug="${esc(r.slug)}"><b>${esc(r.name)}</b><span>${esc(activity(r))}</span></a>`).join('');
  index.addEventListener('click', (e) => {
    const a = e.target.closest('[data-slug]'); if (!a) return;
    e.preventDefault();
    history.replaceState(null, '', '#' + a.dataset.slug);
    open(a.dataset.slug);
  });
}

function messageHTML(m, cont, mine) {
  const who = m.author;
  return `<div class="msg ${cont ? 'msg--cont' : ''} ${mine ? 'msg--mine' : ''}">
      <a href="${href(`/members/${who.id}/`)}" tabindex="-1" aria-hidden="true">${portrait(who, { size: 40, cls: 'avatar' })}</a>
      <div>
        <div class="msg__head"><a class="msg__who" href="${href(`/members/${who.id}/`)}">${esc(who.name)}${seal({ size: 'xs' })}</a><time class="msg__time" datetime="${esc(m.at)}">${stamp(m.at)}</time></div>
        <p class="msg__bubble">${esc(m.text)}</p>
      </div>
    </div>`;
}

function paint(messages) {
  if (!messages.length) {
    msgs.innerHTML = `<div class="room__empty"><b>No one has posted here yet.</b><p>${session.member && session.member.status === 'verified' ? 'Start the conversation. Everyone who reads this room sees your name and your stamp.' : 'Verified members can start the conversation. Everyone can read it.'}</p></div>`;
    return;
  }
  const mineId = session.member && session.member.id;
  let prev = null;
  msgs.innerHTML = [...messages].sort((a, b) => a.at.localeCompare(b.at)).map((m) => { const cont = prev === m.by; prev = m.by; return messageHTML(m, cont, mineId && m.by === mineId); }).join('');
  scroller.scrollTop = scroller.scrollHeight;
}

async function open(slug) {
  const r = bySlug[slug] || ROOMS[0];
  if (!r || current === r) return;
  current = r;
  $('[data-room-name]').textContent = r.name;
  $('[data-room-topic]').textContent = r.topic;
  index.querySelectorAll('[data-slug]').forEach((a) => a.setAttribute('aria-current', String(a.dataset.slug === r.slug)));
  msgs.innerHTML = '<p class="room__topic">Loading messages…</p>';
  let messages = [];
  try { messages = await loadRoomMessages(r); }
  catch { if (current === r) msgs.innerHTML = '<div class="room__empty"><b>Messages couldn’t be loaded.</b><p>Check your connection and choose the room again.</p></div>'; return; }
  if (current === r) paint(messages);
  document.title = `${r.name} · Rooms · Trulinq`;
}

/* Verified members can speak and the composer becomes a real one. Everyone else keeps the read-only room with an
   honest next step. */
function composer() {
  const form = $('[data-composer]');
  const input = form.querySelector('.room__input'), cta = form.querySelector('[data-room-cta]');
  const m = session.member;
  if (!m || m.status !== 'verified') {
    if (m && m.status === 'pending') { cta.querySelector('span').textContent = 'Verification in review'; cta.href = href('/dashboard/'); }
    else if (!session.user) { cta.querySelector('span').textContent = 'Get verified'; }
    return;
  }
  form.classList.add('is-open');
  input.disabled = false; input.placeholder = 'Say something to the room';
  const send = document.createElement('button');
  send.type = 'submit'; send.className = 'btn btn--primary btn--sm'; send.innerHTML = '<span>Send</span>';
  cta.replaceWith(send);
  const err = document.createElement('p'); err.className = 'room__composer-err'; err.setAttribute('aria-live', 'polite'); form.appendChild(err);
  input.addEventListener('input', () => { err.textContent = ''; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) { err.textContent = 'Write something first.'; input.focus(); return; }
    if (!current) return;
    busy(send, true); input.disabled = true;
    try {
      const { message } = await api.post(`/rooms/${encodeURIComponent(current.slug)}/messages`, { body });
      if (current._messages) current._messages.push(message);
      const existing = msgs.querySelectorAll('.msg');
      const last = existing[existing.length - 1];
      if (!existing.length) msgs.innerHTML = '';
      const cont = !!last && last.querySelector('.msg__who')?.getAttribute('href') === href(`/members/${message.by}/`);
      msgs.insertAdjacentHTML('beforeend', messageHTML(message, cont, true));
      input.value = '';
      scroller.scrollTop = scroller.scrollHeight;
      current.lastMessageAt = message.at;
      const link = index.querySelector(`[data-slug="${CSS.escape(current.slug)}"] span`); if (link) link.textContent = activity(current);
    } catch (e2) {
      err.textContent = e2 instanceof ApiError && e2.status !== 0 && e2.status !== 503 ? e2.message : 'The message couldn’t be sent. Your text is still here; try again.';
    } finally { busy(send, false); input.disabled = false; input.focus(); }
  });
}

boot(async () => {
  [ROOMS, session] = await Promise.all([loadRooms().catch(() => []), loadSession()]);
  if (!ROOMS.length) { toast('Rooms couldn’t be loaded right now.'); return; }
  bySlug = Object.fromEntries(ROOMS.map((r) => [r.slug, r]));
  buildIndex(); composer();
  await open((location.hash || '').slice(1) || ROOMS[0].slug);
  window.addEventListener('hashchange', () => open(location.hash.slice(1)));
});
