import '../../styles/main.css';
import '../../styles/pages/member.css';
import '../../styles/pages/feed.css';
import { boot, gsap, ScrollTrigger, reduced, toast, suspend, restore } from '../main.js';
import { Flip } from 'gsap/Flip';
import { postHTML, photo, fmtDate, href } from '../ui.js';
import { MEMBERS, byId } from '../../data/members.js';
import { POSTS } from '../../data/feed.js';
import { ROOMS } from '../../data/rooms.js';

gsap.registerPlugin(Flip);
const list = document.querySelector('[data-list]');
const count = document.querySelector('[data-count]');
let kind = 'All', first = true;

function build() {
  list.innerHTML = POSTS.map((p) => postHTML(p, byId[p.by]).replace('class="post"', `class="post" data-kind="${p.kind}"`)).join('');
  const newest = [...MEMBERS].sort((a, b) => b.verifiedOn.localeCompare(a.verifiedOn)).slice(0, 4);
  document.querySelector('[data-new-stamps]').innerHTML = newest.map((m) => `<a class="person-row" href="${href(`/members/${m.id}/`)}"><img class="avatar" src="${photo(m.photo, 96)}" alt=""><span><b>${m.name}</b><span>${m.company}</span></span><time datetime="${m.verifiedOn}">${fmtDate(m.verifiedOn).replace(', 2026', '')}</time></a>`).join('');
  document.querySelector('[data-live-rooms]').innerHTML = ROOMS.filter((r) => r.live).slice(0, 3).map((r) => `<a class="room-row" href="${href(`/rooms/#${r.slug}`)}"><span class="emoji" aria-hidden="true">${r.emoji}</span><span><b>${r.name}</b><span>${r.members.length} members</span></span><em>Live</em></a>`).join('');
  list.addEventListener('click', (e) => { if (e.target.closest('.post__foot span')) toast('Sign in to reply.'); });
  document.querySelector('[data-older]').addEventListener('click', (e) => {
    e.currentTarget.hidden = true; const note = document.querySelector('[data-end-note]'); note.hidden = false;
    if (!reduced) gsap.from(note, { y: 16, opacity: 0, duration: .8, ease: 'expo.out' });
  });
  document.querySelector('[data-filters]').addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (!b) return; kind = b.dataset.kind; render(); });
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
