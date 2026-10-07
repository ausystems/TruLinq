import '../../styles/main.css';
import '../../styles/pages/feed.css';
import { boot, busy, toast } from '../main.js';
import { postHTML, portrait, esc, href, fmtDate, relTime } from '../ui.js';
import { api, ApiError } from '../api.js';
import { loadMembers, loadPosts, loadRooms, loadSession } from '../data.js';

const $ = (s) => document.querySelector(s);
const list = $('[data-list]');
let kind = 'All', session = { user: null, member: null }, posts = [];

function render() {
  const shown = posts.filter((p) => kind === 'All' || p.kind === kind);
  list.innerHTML = shown.map((p) => postHTML(p, p.author)).join('');
  $('[data-count]').textContent = posts.length ? `${shown.length} post${shown.length === 1 ? '' : 's'}${kind === 'All' ? '' : ` of ${posts.length}`} · newest first` : '';
  $('[data-count]').hidden = !posts.length;
  const empty = $('[data-empty]');
  empty.hidden = shown.length > 0;
  if (!shown.length && posts.length) { empty.querySelector('h3').textContent = 'Nothing in this filter yet.'; empty.querySelector('p').textContent = 'Choose All to see every post, newest first.'; }
  const end = $('[data-end]');
  end.hidden = !shown.length;
  if (shown.length) end.textContent = `That’s every post since ${fmtDate(shown[shown.length - 1].at)}.`;
  document.querySelectorAll('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kind === kind)));
}

/* The composer opens for verified members; everyone else keeps the lock with an honest next step. */
function composer() {
  const form = $('[data-composer]');
  const lock = $('[data-composer-lock]');
  const m = session.member;
  if (!m || m.status !== 'verified') {
    const a = lock.querySelector('[data-lock-primary]');
    if (session.user) lock.querySelector('[data-lock-signin]').hidden = true;
    if (m) { a.href = href(m.status === 'pending' ? '/dashboard/' : '/verify/'); a.querySelector('span').textContent = m.status === 'pending' ? 'Verification in review' : 'Get verified to post'; }
    return;
  }
  lock.hidden = true;
  const input = form.querySelector('textarea'), kinds = [...form.querySelectorAll('[data-kinds] button')], send = form.querySelector('button[type=submit]');
  const field = input.closest('.field'), err = $('[data-composer-err]');
  input.disabled = false; kinds.forEach((b) => (b.disabled = false)); send.disabled = false;
  $('[data-composer-avatar]').innerHTML = portrait(m, { size: 40 });
  let selected = 'Win';
  kinds.forEach((b) => b.addEventListener('click', () => { selected = b.textContent.trim(); kinds.forEach((x) => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', String(on)); }); }));
  input.addEventListener('input', () => field.classList.remove('is-invalid'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) { err.textContent = 'Write something first.'; field.classList.add('is-invalid'); input.focus(); return; }
    busy(send, true);
    try {
      const { post } = await api.post('/posts', { kind: selected, body });
      posts.unshift(post);
      input.value = '';
      kind = 'All';
      render();
      toast('Posted to the feed.');
    } catch (e2) {
      err.textContent = e2 instanceof ApiError && e2.status !== 0 && e2.status !== 503 ? e2.message : 'The post couldn’t be saved. Your text is still here; try again.';
      field.classList.add('is-invalid');
    } finally { busy(send, false); }
  });
}

async function build() {
  const [loaded, { members }, rooms, s] = await Promise.all([loadPosts(50).catch(() => []), loadMembers(), loadRooms().catch(() => []), loadSession()]);
  session = s;
  posts = [...loaded].sort((a, b) => b.at.localeCompare(a.at));
  render();

  const newest = [...members].filter((m) => m.verifiedOn).sort((a, b) => b.verifiedOn.localeCompare(a.verifiedOn) || a.name.localeCompare(b.name)).slice(0, 4);
  $('[data-new-stamps]').innerHTML = newest.map((m) => `<a class="person-row" href="${href(`/members/${m.id}/`)}">${portrait(m, { size: 36, cls: 'avatar' })}<span><b>${esc(m.name)}</b><span>${esc(m.company || m.headline || '')}</span></span><time datetime="${esc(m.verifiedOn)}">${fmtDate(m.verifiedOn, { day: 'numeric', month: 'short' })}</time></a>`).join('');
  $('[data-rooms]').innerHTML = rooms.map((r) => `<a class="room-row" href="${href(`/rooms/#${r.slug}`)}"><b>${esc(r.name)}</b><span>${r.lastMessageAt ? `Last message ${relTime(r.lastMessageAt)}` : 'No messages yet'}</span></a>`).join('') || '<p class="meta">Rooms couldn’t be loaded.</p>';

  $('[data-filters]').addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (!b) return; kind = b.dataset.kind; render(); });
  composer();
}

boot(build).catch(() => toast('The feed couldn’t be loaded.'));
