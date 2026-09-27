import '../../styles/main.css';
import '../../styles/pages/dashboard.css';
import { boot, busy, go, toast, stamp, setInvalid, clearOnEdit, whenVisible, reduced, gsap } from '../main.js';
import { idCard, postHTML, portrait, seal, esc, href, fmtDate, scoreOf } from '../ui.js';
import { gaugeHTML, factorsHTML, runGauge } from '../gauge.js';
import { api, ApiError, isBackendUnavailable } from '../api.js';
import { loadSession, INDUSTRIES } from '../data.js';
import { BILLING, PLANS } from '../../data/billing.js';
import { SITE } from '../../data/site.js';
import { demoAccount } from '../../data/demo.js';

const $ = (s) => document.querySelector(s);
const MONTH = 30.4375 * 864e5; /* the score engine's month (server/lib/score.ts) */
const dayOf = (iso) => (iso || '').slice(0, 10);
const addDays = (iso, days) => new Date(new Date(dayOf(iso) + 'T12:00:00').getTime() + days * 864e5).toISOString().slice(0, 10);
const addMonths = (iso, n) => { const d = new Date(dayOf(iso) + 'T12:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);
const businessDaysAfter = (iso, n) => { const d = new Date(dayOf(iso) + 'T12:00:00'); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n--; } return d.toISOString().slice(0, 10); };
const STATUS = { verified: ['Verified · stamp active', 'tag--verified'], pending: ['In review', 'tag--pending'], unverified: ['Not verified yet', ''], revoked: ['Stamp revoked', 'tag--danger'] };
const REQ = { submitted: ['Submitted', 'tag--pending'], in_review: ['In review', 'tag--pending'], approved: ['Approved', 'tag--verified'], rejected: ['Declined', 'tag--danger'], withdrawn: ['Withdrawn', ''] };
const DETAIL = { photo: 'a profile photo', bio: 'a bio', industry: 'your industry', city: 'your city', website: 'your website', founded: 'the year you founded', offers: 'what you offer', looking: 'what you’re looking for' };
const ICON = {
  id: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="12" r="2.2"/><path d="M14 10h4M14 14h3"/></svg>',
  reg: '<svg viewBox="0 0 24 24"><path d="M6 3h9l5 5v13H6z"/><path d="M14 3v6h6M9 13h7M9 17h7"/></svg>',
  web: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
};

let me = null;

/* ── Load: the signed-in record, or the labelled demo when accounts can't be reached ── */
async function load() {
  const s = await loadSession();
  if (s.offline) return demoAccount();
  if (!s.user) { location.replace(href(`/auth/?next=${encodeURIComponent(href('/dashboard/'))}`)); return null; }
  try { return await api.get('/me'); }
  catch (e) {
    if (isBackendUnavailable(e)) return demoAccount();
    if (e instanceof ApiError && e.status === 401) { location.replace(href(`/auth/?next=${encodeURIComponent(href('/dashboard/'))}`)); return null; }
    throw e;
  }
}

function paintHead() {
  const m = me.member, verified = m.status === 'verified';
  $('[data-demo]').hidden = !me.demo;
  const h = new Date().getHours();
  $('[data-title]').textContent = me.demo ? 'A sample verification record.' : `${h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'}, ${m.first || m.name}.`;
  const [label, cls] = STATUS[m.status] || STATUS.unverified;
  const tag = $('[data-status]'); tag.textContent = label; tag.className = `tag ${cls}`;
  $('[data-renew-line]').hidden = !verified;
  if (verified) $('[data-renew]').textContent = fmtDate(addMonths(m.verifiedOn, SITE.reverifyMonths));
  const pub = $('[data-public]');
  if (me.demo) pub.hidden = true; else pub.href = href(`/members/${m.id}/`);
  $('[data-idcard-mount]').innerHTML = idCard({ ...m, score: scoreOf(m.factors) }, { link: false, stamp: verified ? 'manual' : 'none' });
}

function paintTimeline() {
  const m = me.member, v = me.verification, verified = m.status === 'verified';
  const events = [['Account created', dayOf(m.createdAt || m.joined), verified ? 'Profile published to the directory as a verified member.' : 'Profile created. It appears in the directory once it’s verified.']];
  if (v) {
    events.push(['Application submitted', dayOf(v.submittedAt), `Reference ${v.reference}. ${v.documents ? `${v.documents} document${v.documents === 1 ? '' : 's'} on file.` : 'No document on file yet; a reviewer will ask for it by email.'}`]);
    if (v.reviewStartedAt) events.push(['Review started', dayOf(v.reviewStartedAt), 'A reviewer is checking your documents, the registry and your domain.']);
    if (v.status === 'rejected' && v.decidedAt) events.push(['Application declined', dayOf(v.decidedAt), v.note || 'The reason was sent by email. You can apply again once it’s fixed.']);
    if (v.status === 'submitted' || v.status === 'in_review') events.push(['Decision expected', businessDaysAfter(v.submittedAt, SITE.review.businessDays), 'A reviewer approves the stamp or tells you exactly what needs fixing.']);
  }
  if (verified) events.push(['Stamp issued', m.verifiedOn, 'The Trulinq Verified stamp was added to your profile.'], ['Re-verification', addMonths(m.verifiedOn, SITE.reverifyMonths), 'We check again so a stamp never outlives a business.']);
  else if (!v || v.status === 'rejected') events.push(['Verification', '', 'Start an application from Get verified to earn the stamp.']);
  const now = today();
  const tl = $('[data-timeline]');
  tl.innerHTML = events.map(([title, date, note]) => `<li class="tl ${date && date <= now ? 'is-done' : 'is-future'}"><span class="tl__title">${esc(title)}</span><time class="tl__date"${date ? ` datetime="${date}"` : ''}>${date ? fmtDate(date) : 'Not started'}</time><span class="tl__note">${esc(note)}</span></li>`).join('');
  const done = tl.querySelectorAll('.is-done'); if (done.length) done[done.length - 1].classList.add('is-now');
}

/* The next things that would move the score, with the exact change, from the same rules the engine uses. */
function nextSteps(m) {
  const base = scoreOf(m.factors), out = [];
  const gain = (i, v) => { const f = [...m.factors]; f[i] = v; return scoreOf(f) - base; };
  const [identity, , web, history, standing] = m.factors;
  if (!identity) out.push(['Complete verification', gain(0, 45)]);
  const missing = Object.entries(m.completeness || {}).filter(([k, v]) => !v && k !== 'photo').map(([k]) => k);
  const have = Object.values(m.completeness || {}).filter(Boolean).length;
  if (missing.length) out.push([`Add ${DETAIL[missing[0]]}`, gain(1, Math.round(((have + 1) / 8) * 20))]);
  if (web < 15) out.push([m.website ? 'Have your domain confirmed' : 'Link your business website', gain(2, m.website ? 15 : 10)]);
  if (history < 10) out.push([`Stay on Trulinq past ${fmtDate(new Date(new Date(dayOf(m.joined) + 'T12:00:00').getTime() + (3 * history + 1.5) * MONTH).toISOString())}`, gain(3, history + 1)]);
  if (identity && m.verifiedOn && standing < 10) out.push([`Hold your stamp past ${fmtDate(new Date(new Date(m.verifiedOn + 'T12:00:00').getTime() + (standing + .5) * MONTH).toISOString())}`, gain(4, standing + 1)]);
  return out.filter(([, g]) => g > 0).slice(0, 4);
}

function paintScore() {
  const m = me.member;
  $('[data-gauge-mount]').innerHTML = gaugeHTML({ caption: [m.name, m.company].filter(Boolean).join(' · ') });
  $('[data-factors-mount]').innerHTML = factorsHTML(m);
  const hints = nextSteps(m);
  $('[data-hints-wrap]').hidden = !hints.length;
  $('[data-hints]').innerHTML = hints.map(([what, g]) => `<li class="ledger__row"><span>${esc(what)}</span><i></i><b>+${g}</b></li>`).join('');
}

function paintDocuments() {
  const m = me.member, v = me.verification;
  const row = (icon, title, detail, [label, cls], date) => `<li class="doc"><span class="doc__icon" aria-hidden="true">${icon}</span><span class="doc__body"><b>${esc(title)}</b><span>${detail}</span></span><span class="tag ${cls}">${esc(label)}</span><span class="doc__date">${date ? fmtDate(date) : '—'}</span></li>`;
  const redacted = '<span class="redact" style="--w:9ch" aria-label="registration number hidden"></span>';
  const docs = [];
  if (v) {
    docs.push(row(ICON.id, 'Government ID', esc([v.identity.idType, v.identity.country].filter(Boolean).join(' · ') || 'ID'), v.documents ? REQ[v.status] || ['On file', ''] : ['Not uploaded', 'tag--pending'], v.submittedAt));
    docs.push(row(ICON.reg, 'Business registration', v.business.registration ? esc([v.business.name, v.business.registration].filter(Boolean).join(' · ')) : `${esc(v.business.name || 'Business')} · ${redacted}`, REQ[v.status] || ['On file', ''], v.submittedAt));
  } else {
    docs.push(row(ICON.id, 'Government ID', 'Not submitted yet', ['Missing', ''], null));
    docs.push(row(ICON.reg, 'Business registration', 'Not submitted yet', ['Missing', ''], null));
  }
  const web = m.factors[2];
  docs.push(row(ICON.web, 'Website', esc(m.website || 'No website linked'), m.website ? (web >= 15 ? ['Confirmed', 'tag--verified'] : ['Linked', 'tag--pending']) : ['None', ''], m.website ? (m.verifiedOn || (v && v.submittedAt)) : null));
  $('[data-docs]').innerHTML = docs.join('');
}

function paintActivity() {
  const m = me.member;
  const vouches = me.endorsements || [];
  $('[data-vouch-count]').textContent = `(${vouches.length})`;
  $('[data-vouches]').innerHTML = vouches.map((e) => `<figure class="vouch-card"><blockquote>${esc(e.text)}</blockquote><figcaption><a href="${href(`/members/${e.from.id}/`)}">${portrait(e.from, { size: 32, cls: 'avatar' })}<span><b>${esc(e.from.name)}</b>${esc([e.from.role, e.from.company].filter(Boolean).join(', '))}</span></a>${seal({ size: 'xs' })}<time datetime="${esc(e.date)}">${fmtDate(e.date)}</time></figcaption></figure>`).join('')
    || `<div class="empty"><h3>No endorsements yet.</h3><p>Ask someone you’ve worked with to vouch for you. Each member can write one, and it’s always public.</p></div>`;
  $('[data-posts]').innerHTML = (me.posts || []).map((p) => postHTML(p, m)).join('')
    || `<div class="empty"><h3>No posts yet.</h3><p>The feed is chronological, so your first post goes straight to the top.</p>${me.demo ? '' : `<a class="btn btn--ink btn--sm" href="${href('/feed/')}"><span>Open the feed</span></a>`}</div>`;
}

/* The completeness ring fills once when it is first seen, then moves from where it is whenever the profile changes. */
const ring = {
  now: 0, to: 0, seen: false, watching: false,
  paint(v) { $('[data-ring-fill]').style.strokeDashoffset = 100 - v; $('[data-ring-num]').textContent = `${Math.round(v)}%`; },
  run() { const st = { v: ring.now }; gsap.to(st, { v: ring.to, duration: 1, ease: 'expo.out', overwrite: true, onUpdate: () => ring.paint(st.v), onComplete: () => { ring.now = ring.to; } }); }
};
function paintCompleteness() {
  const m = me.member;
  const c = m.completeness || {};
  const items = [...document.querySelectorAll('[data-checklist] li')];
  items.forEach((li) => li.classList.toggle('is-done', !!c[li.dataset.key]));
  ring.to = Math.round((items.filter((li) => c[li.dataset.key]).length / items.length) * 100);
  $('[data-ring]').setAttribute('aria-label', `${ring.to}% of your profile is complete`);
  if (reduced) { ring.paint(ring.to); ring.now = ring.to; }
  else if (!ring.watching) { ring.watching = true; whenVisible($('[data-ring]'), () => { ring.seen = true; ring.run(); }); }
  else if (ring.seen) ring.run();
  $('[data-photo-note]').hidden = !!c.photo;
}

function paintRail() {
  const m = me.member;
  paintCompleteness();

  /* invitation code: real accounts only */
  const invite = me.referrals || { count: 0 };
  if (!me.demo && m.referralLink) {
    $('[data-invite-box]').hidden = false;
    $('[data-invite-code]').textContent = m.referralCode;
    const copy = $('[data-copy]');
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(m.referralLink); copy.querySelector('span').textContent = 'Link copied'; setTimeout(() => (copy.querySelector('span').textContent = 'Copy invite link'), 2400); }
      catch { toast(`Your invite link: ${m.referralLink}`, { ms: 8000 }); }
    });
    $('[data-invite-count]').textContent = invite.count ? `${invite.count} ${invite.count === 1 ? 'person has' : 'people have'} joined with your code.` : 'No one has joined with your code yet.';
  } else {
    $('[data-invite-text]').textContent = 'Signed-in members get an invitation code to share with people they trust.';
    $('[data-invite-count]').textContent = '';
  }
  if (invite.referredBy) $('[data-invite-count]').insertAdjacentHTML('beforeend', ` You were invited by <a class="link" href="${href(`/members/${invite.referredBy.id}/`)}">${esc(invite.referredBy.name)}</a>.`);

  /* billing: only what is actually on record */
  const sub = me.subscription;
  const rows = sub
    ? [['Plan', sub.plan === 'verified_business' ? PLANS.verified.name : sub.plan], ['Price', sub.period === 'monthly' ? `${BILLING.monthlyPerMonth} a month` : `${BILLING.yearlyPerYear} a year`], ['Renews', sub.current_period_end ? fmtDate(sub.current_period_end) : '—'], ['Card', sub.card_last4 ? `ending ${sub.card_last4}` : '—']]
    : [['Plan', m.status === 'verified' ? PLANS.verified.name : PLANS.member.name], ['Charged so far', '$0']];
  const ledger = $('[data-billing]');
  ledger.innerHTML = rows.map(() => '<li class="ledger__row"><span></span><i></i><b></b></li>').join('');
  ledger.querySelectorAll('.ledger__row').forEach((li, i) => { li.querySelector('span').textContent = rows[i][0]; li.querySelector('b').textContent = rows[i][1]; });
  $('[data-billing-note]').textContent = sub ? `To change or cancel your plan, write to ${SITE.email.support}.` : `Card payments aren’t connected yet, so nothing has been charged. The Verified Business plan will be ${BILLING.yearlyPerMonth} a month, billed yearly.`;

  const signout = $('[data-signout]');
  if (me.demo) signout.hidden = true;
  else signout.addEventListener('click', async () => { busy(signout, true); try { await api.post('/auth/logout'); } catch { /* the session is cleared server-side or already gone */ } go(href('/')); });
}

/* ── The profile editor: PATCH /api/me, field errors from the server land on their fields ── */
const FIELDS = ['name', 'headline', 'role', 'company', 'city', 'region', 'country', 'industry', 'founded', 'website', 'bio', 'offers', 'looking'];
function editor() {
  const dialog = $('[data-editor]'), form = $('[data-editor-form]'), error = $('[data-editor-error]');
  const vis = form.querySelector('[data-visibility]');
  $('[data-editor-industries]').insertAdjacentHTML('beforeend', INDUSTRIES.map((i) => `<option value="${esc(i)}">${esc(i)}</option>`).join(''));
  const bio = form.querySelector('#p-bio'), bioCount = form.querySelector('[data-count-for="p-bio"]');
  const count = () => { bioCount.textContent = `${bio.value.length} of 600`; };
  bio.addEventListener('input', count);
  clearOnEdit(form);
  const fill = () => {
    const m = me.member;
    FIELDS.forEach((k) => { const el = form.elements[k]; if (el) el.value = m[k] == null ? '' : String(m[k]); });
    vis.checked = (m.visibility || 'public') === 'public';
    error.hidden = true; count();
    form.querySelectorAll('.field.is-invalid').forEach((f) => f.classList.remove('is-invalid'));
  };
  const open = () => {
    if (me.demo) { toast('Editing is off in the demo. Sign in to edit your own profile.'); return; }
    fill(); dialog.showModal(); form.elements.name.focus();
  };
  document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', open));
  dialog.querySelectorAll('[data-editor-close]').forEach((b) => b.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  if (location.hash === '#profile' && !me.demo) open();
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    const name = form.elements.name, founded = form.elements.founded, website = form.elements.website;
    const badName = name.value.trim().length < 2;
    const badYear = !!founded.value.trim() && !/^\d{4}$/.test(founded.value.trim());
    const badSite = !!website.value.trim() && !/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(website.value.trim());
    setInvalid(name, badName); setInvalid(founded, badYear); setInvalid(website, badSite);
    const first = [[badName, name], [badYear, founded], [badSite, website]].find(([b]) => b);
    if (first) { first[1].focus(); return; }
    const body = {};
    FIELDS.forEach((k) => { const v = form.elements[k].value.trim(); body[k] = k === 'founded' ? (v ? Number(v) : null) : v; });
    body.visibility = vis.checked ? 'public' : 'private';
    const btn = form.querySelector('button[type=submit]');
    busy(btn, true);
    try {
      const r = await api.patch('/me', body);
      me.member = { ...me.member, ...r.member };
      dialog.close();
      render({ restamp: false });
      paintCompleteness();
      toast('Profile saved.');
    } catch (err) {
      let placed = false;
      if (err instanceof ApiError) FIELDS.forEach((k) => { const msg = err.field(k); if (msg) { setInvalid(form.elements[k], true, msg); if (!placed) form.elements[k].focus(); placed = true; } });
      if (!placed) { error.textContent = err instanceof ApiError && err.status !== 0 && err.status !== 503 ? err.message : 'Your changes couldn’t be saved right now. They’re still in the form; try again.'; error.hidden = false; }
    } finally { busy(btn, false); }
  });
}

function render({ restamp = true } = {}) {
  paintHead(); paintTimeline(); paintScore(); paintDocuments(); paintActivity();
  const seal = $('[data-idcard-mount] .seal');
  if (seal) { if (restamp) stamp(seal, { delay: .4, rotate: -6 }); else seal.classList.add('is-stamped'); }
  runGauge($('[data-gauge-root]'), me.member.factors, { trigger: $('#score') });
}

boot(async () => {
  try { me = await load(); }
  catch (e) {
    console.error('[trulinq] dashboard', e);
    const tag = $('[data-status]'); tag.textContent = 'Your record couldn’t be loaded. Refresh the page to try again.'; tag.className = 'tag tag--danger';
    return;
  }
  if (!me) return;
  render(); paintRail(); editor();
  $('[data-dash]').removeAttribute('aria-busy');
});
