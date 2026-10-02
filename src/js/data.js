/* Data loaders for the pages. Everything comes from the backend. When the API cannot be reached at all (a static
   host with no backend configured), read-only pages fall back to the roster the database is seeded with, so they
   still show real members. Nothing that writes ever falls back. */
import { api, isBackendUnavailable } from './api.js';
import { scoreOf, gradeOf } from './ui.js';
import { statsOf } from '../data/stats.js';

let offline = false;
export const isOffline = () => offline;
function fallback(e) {
  if (!isBackendUnavailable(e)) throw e;
  if (!offline) { offline = true; console.info('[trulinq] API unavailable; showing the seeded roster'); }
}

export { INDUSTRIES } from '../data/industries.js';

const index = (members) => ({ members, byId: Object.fromEntries(members.map((m) => [m.id, m])) });
const complete = (m) => { const score = scoreOf(m.factors), g = gradeOf(score); return { ...m, status: 'verified', score, grade: g.grade, band: g.band }; };

let membersPromise = null;
/* Public members with the field names the pages use. `all` includes members whose verification is still pending. */
export function loadMembers({ all = false } = {}) {
  if (all) return api.get('/members?limit=50&status=all').then((d) => index(d.members)).catch(async (e) => { fallback(e); return loadMembers(); });
  if (!membersPromise) membersPromise = api.get('/members?limit=50').then((d) => index(d.members)).catch(async (e) => {
    fallback(e);
    const { MEMBERS } = await import('../data/members.js');
    return index(MEMBERS.map(complete));
  });
  return membersPromise;
}

export async function loadMember(slug) {
  try { return await api.get(`/members/${encodeURIComponent(slug)}`); }
  catch (e) {
    /* the API's own 404 means there is no such member; a static host with no backend answers 404 too, without a code */
    if (e && e.status === 404 && !isBackendUnavailable(e)) return null;
    fallback(e);
    const { MEMBERS, byId, VOUCHES } = await import('../data/members.js');
    const { POSTS } = await import('../data/feed.js');
    const m = byId[slug];
    if (!m) return null;
    const list = MEMBERS.map(complete);
    const i = list.findIndex((x) => x.id === slug), n = list.length;
    return {
      member: complete(m),
      endorsements: (VOUCHES[slug] || []).map((v, k) => ({ id: `${slug}-${k}`, text: v.text, date: v.date, from: complete(byId[v.from]) })),
      posts: POSTS.filter((p) => p.by === slug),
      prev: list[(i - 1 + n) % n].id, next: list[(i + 1) % n].id
    };
  }
}

export async function loadPosts(limit = 50) {
  try { return (await api.get(`/posts?limit=${limit}`)).posts; }
  catch (e) {
    fallback(e);
    const { POSTS } = await import('../data/feed.js');
    const { byId } = await loadMembers();
    return POSTS.map((p) => ({ ...p, author: byId[p.by] }));
  }
}

export async function loadRooms() {
  try { return (await api.get('/rooms')).rooms; }
  catch (e) {
    fallback(e);
    const { ROOMS } = await import('../data/rooms.js');
    return ROOMS.map((r) => ({ slug: r.slug, name: r.name, topic: r.topic, memberCount: r.members.length, members: [], lastMessageAt: null, _messages: r.messages }));
  }
}

export async function loadRoomMessages(room) {
  if (room._messages) return room._messages;
  return (await api.get(`/rooms/${encodeURIComponent(room.slug)}/messages?limit=200`)).messages;
}

export async function loadStats() {
  try { return await api.get('/stats'); }
  catch (e) {
    fallback(e);
    const { MEMBERS } = await import('../data/members.js');
    const { POSTS } = await import('../data/feed.js');
    return statsOf(MEMBERS, POSTS);
  }
}

let sessionPromise = null;
/* The signed-in user and member, or { user: null, member: null, offline }. Never throws. */
export function loadSession(force = false) {
  if (!sessionPromise || force) sessionPromise = api.get('/auth/session').then((s) => ({ ...s, offline: false })).catch((e) => ({ user: null, member: null, offline: isBackendUnavailable(e) }));
  return sessionPromise;
}
