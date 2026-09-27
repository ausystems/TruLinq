/* Data loaders for the pages. Everything comes from the backend; the demo roster in src/data/ is the same content
   the database is seeded with and is used only when the API cannot be reached (a static host with no backend
   configured), so read-only pages still render. Nothing that writes ever falls back. */
import { api, isBackendUnavailable } from './api.js';

let warned = false;
function warn(e) { if (!warned) { warned = true; console.warn('[trulinq] backend unavailable, showing the seed roster:', e && e.message); } }

export const INDUSTRIES = ['Consulting', 'Direct sales/service', 'Energy', 'Logistics', 'Marketing', 'Real Estate', 'Restaurant', 'Technology'];

const index = (members) => ({ members, byId: Object.fromEntries(members.map((m) => [m.id, m])) });

let membersPromise = null;
/** Verified, public members (first 50) with the field names the pages already use. */
export function loadMembers() {
  if (!membersPromise) membersPromise = api.get('/members?limit=50').then((d) => index(d.members)).catch(async (e) => {
    if (!isBackendUnavailable(e)) throw e;
    warn(e);
    const { MEMBERS } = await import('../data/members.js');
    const { scoreOf, gradeOf } = await import('./ui.js');
    return index(MEMBERS.map((m) => ({ ...m, status: 'verified', score: scoreOf(m.factors), grade: gradeOf(scoreOf(m.factors)).grade })));
  });
  return membersPromise;
}

export async function loadMember(slug) {
  try { return await api.get(`/members/${encodeURIComponent(slug)}`); }
  catch (e) {
    if (!isBackendUnavailable(e)) throw e;
    warn(e);
    const { byId, VOUCHES, MEMBERS } = await import('../data/members.js');
    const { POSTS } = await import('../data/feed.js');
    const m = byId[slug];
    if (!m) return null;
    const i = MEMBERS.findIndex((x) => x.id === slug), n = MEMBERS.length;
    return {
      member: m,
      endorsements: (VOUCHES[slug] || []).map((v, k) => ({ id: `${slug}-${k}`, text: v.text, date: v.date, from: byId[v.from] })),
      posts: POSTS.filter((p) => p.by === slug),
      prev: MEMBERS[(i - 1 + n) % n].id, next: MEMBERS[(i + 1) % n].id
    };
  }
}

export async function loadPosts(limit = 50) {
  try { return (await api.get(`/posts?limit=${limit}`)).posts; }
  catch (e) {
    if (!isBackendUnavailable(e)) throw e;
    warn(e);
    const { POSTS } = await import('../data/feed.js');
    const { byId } = await loadMembers();
    return POSTS.map((p) => ({ ...p, author: byId[p.by] }));
  }
}

export async function loadRooms() {
  try { return (await api.get('/rooms')).rooms; }
  catch (e) {
    if (!isBackendUnavailable(e)) throw e;
    warn(e);
    const { ROOMS } = await import('../data/rooms.js');
    const { byId } = await loadMembers();
    return ROOMS.map((r) => ({ slug: r.slug, name: r.name, emoji: r.emoji, topic: r.topic, live: r.live, memberCount: r.members.length, members: r.members.slice(0, 3).map((id) => byId[id]), _messages: r.messages.map((m, i) => ({ id: `${r.slug}-${i}`, by: m.by, text: m.text, at: m.at, author: byId[m.by] })) }));
  }
}

export async function loadRoomMessages(room) {
  if (room._messages) return room._messages;
  return (await api.get(`/rooms/${encodeURIComponent(room.slug)}/messages?limit=200`)).messages;
}

export async function loadStats() {
  try { return await api.get('/stats'); }
  catch (e) {
    if (!isBackendUnavailable(e)) throw e;
    warn(e);
    const { members } = await loadMembers();
    return { people: members.length, verified: members.length, posts: 12, deals: 0, cities: new Set(members.map((m) => m.city)).size, industries: new Set(members.map((m) => m.industry)).size };
  }
}

let sessionPromise = null;
/** The signed-in user and member, or { user: null, member: null }. Never throws: no backend means no session. */
export function loadSession(force = false) {
  if (!sessionPromise || force) sessionPromise = api.get('/auth/session').catch(() => ({ user: null, member: null }));
  return sessionPromise;
}
