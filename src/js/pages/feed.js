import '../../styles/main.css';
import '../../styles/pages/member.css';
import '../../styles/pages/feed.css';
import { boot, gsap, ScrollTrigger, reduced, toast, suspend, restore, hydrateSeals } from '../main.js';
import { Flip } from 'gsap/Flip';
import { postHTML, photo, fmtDate, href } from '../ui.js';
import { api, ApiError } from '../api.js';
import { loadMembers, loadPosts, loadRooms, loadSession } from '../data.js';

gsap.registerPlugin(Flip);
const list = document.querySelector('[data-list]');
const count = document.querySelector('[data-count]');
let kind = 'All', first = true, session = { user: null, member: null };

const postEl = (p) => postHTML(p, p.author).replace('class="post"', `class="post" data-kind="${p.kind}"`);

async function build() {
  const [posts, { members }, rooms, s] = await Promise.all([loadPosts(50), loadMembers(), loadRooms(), loadSession()]);
  session = s;
  list.innerHTML = posts.map(postEl).join('');
  const newest = [...members].sort((a, b) => (b.verifiedOn || '').localeCompare(a.verifiedOn || '')).slice(0, 4);
  document.querySelector('[data-new-stamps]').innerHTML = newest.map((m) => `<a class="person-row" href="${href(`/members/${m.id}/`)}"><img class="avatar" src="${photo(m.photo, 96)}" alt=""><span><b>${m.name}</b><span>${m.company}</span></span><time datetime="${m.verifiedOn}">${fmtDate(m.verifiedOn).replace(/, \d{4}$/, '')}</time></a>`).join('');
  document.querySelector('[data-live-rooms]').innerHTML = rooms.filter((r) => r.live).slice(0, 3).map((r) => `<a class="room-row" href="${href(`/rooms/#${r.slug}`)}"><span class="emoji" aria-hidden="true">${r.emoji}</span><span><b>${r.name}</b><span>${r.memberCount} members</span></span><em>Live</em></a>`).join('');
  list.addEventListener('click', (e) => { if (e.target.closest('.post__foot span')) toast(session.user ? 'Replies are not open yet.' : 'Sign in to reply.'); });
  document.querySelector('[data-older]').addEventListener('click', (e) => {
    e.currentTarget.hidden = true; const note = document.querySelector('[data-end-note]'); note.hidden = false;
    if (!reduced) gsap.from(note, { y: 16, opacity: 0, duration: .8, ease: 'expo.out' });
  });
  document.querySelector('[data-filters]').addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (!b) return; kind = b.dataset.kind; render(); });
  composer();
}

/* The composer opens for verified members; everyone else keeps the lock with an honest next step. */
function composer() {
  const box = document.querySelector('[data-composer]');
  const lock = box.querySelector('.composer__lock');
  const m = session.member;
  if (!m || m.status !== 'verified') {
    if (m) { const a = lock.querySelector('a'); a.href = href('/verify/'); a.querySelector('span').textContent = m.status === 'pending' ? 'Verification in review' : 'Get verified to post'; }
    return;
  }
  lock.hidden = true;
  const input = box.querySelector('.composer__input'), kinds = [...box.querySelectorAll('.segmented button')], send = box.querySelector('.btn');
  input.disabled = false; kinds.forEach((b) => (b.disabled = false)); send.disabled = false;
  box.querySelector('.composer__avatar').style.backgroundImage = `url("${photo(m.photo, 96)}")`;
  box.querySelector('.composer__avatar').style.backgroundSize = 'cover';
  let selected = 'Win';
  kinds.forEach((b) => b.addEventListener('click', () => { selected = b.textContent.trim(); kinds.forEach((x) => x.classList.toggle('is-active', x === b)); }));
  send.addEventListener('click', async () => {
    const body = input.value.trim();
    if (!body) { input.focus(); return; }
    send.disabled = true;
    try {
      const { post } = await api.post('/posts', { kind: selected, body });
      list.insertAdjacentHTML('afterbegin', postEl(post));
      hydrateSeals(list);
      input.value = '';
      render();
      toast('Posted to the feed.');
    } catch (e) { toast(e instanceof ApiError ? e.message : 'The post could not be saved.'); }
    finally { send.disabled = false; }
  });
}

function render() {
  const posts = [...list.querySelectorAll('.post')];
  const state = !reduced && !first ? Flip.getState(posts) : null;
  posts.forEach((p) => (p.hidden = kind !== 'All' && p.dataset.kind !== kind));
  const shown = posts.filter((p) => !p.hidden).length;
  count.textContent = `${shown} post${shown === 1 ? '' : 's'} · newest first`;
  document.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
  if (state) { suspend(posts); Flip.from(state, { duration: .7, ease: 'expo.out', stagger: .02, absolute: true, onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .6 }), onLeave: (els) => gsap.to(els, { opacity: 0, duration: .3 }), onComplete: () => restore(posts) }); }
  else if (!reduced && first) gsap.from(posts, { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: .05, delay: .2, clearProps: 'transform,opacity' });
  first = false;
  setTimeout(() => ScrollTrigger.refresh(), 800);
}

boot(build, render);
