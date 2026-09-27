import '../../styles/main.css';
import '../../styles/pages/member.css';
import '../../styles/pages/dashboard.css';
import { boot, gsap, ScrollTrigger, reduced, toast, stamp, go } from '../main.js';
import { idCard, photo, fmtDate, sealSVG, postHTML, href } from '../ui.js';
import { gaugeHTML, factorsHTML, runGauge } from '../gauge.js';
import { api, ApiError } from '../api.js';
import { loadSession } from '../data.js';

let me = null; /* { user, member, verification, subscription, referrals, endorsements, posts } from GET /api/me */
const addYear = (iso) => { const d = new Date(iso + 'T12:00:00'); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };
const day = (iso) => (iso || '').slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const STATUS_LABEL = { verified: 'Verified · stamp active', pending: 'Pending · in review', unverified: 'Unverified · not yet applied', revoked: 'Stamp revoked' };
const STATUS_PILL = { verified: 'pill--mint', pending: 'pill--sky', unverified: 'pill--sand', revoked: 'pill--rose' };
const REQ_LABEL = { submitted: 'Submitted', in_review: 'In review', approved: 'Approved', rejected: 'Declined', withdrawn: 'Withdrawn' };
const REQ_PILL = { submitted: 'pill--sky', in_review: 'pill--sky', approved: 'pill--mint', rejected: 'pill--rose', withdrawn: 'pill--sand' };

async function build() {
  const s = await loadSession();
  if (!s.user) { location.replace(href('/auth/?next=' + encodeURIComponent('/dashboard/'))); return; }
  try { me = await api.get('/me'); }
  catch (e) { toast(e instanceof ApiError && e.status === 401 ? 'Your session ended. Sign in again.' : 'Your dashboard could not be loaded.'); location.replace(href('/auth/?next=' + encodeURIComponent('/dashboard/'))); return; }
  const m = me.member, v = me.verification, verified = m.status === 'verified';

  const preview = document.querySelector('.dhead__preview'); preview.hidden = true; preview.style.display = 'none'; /* the demo caption; the CSS display rule beats [hidden] */
  const h = new Date().getHours();
  document.querySelector('[data-greeting]').textContent = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  document.querySelector('[data-first]').textContent = m.first;
  const pill = document.querySelector('.dhead__status .pill');
  pill.textContent = STATUS_LABEL[m.status] || m.status; pill.className = `pill ${STATUS_PILL[m.status] || 'pill--sand'}`;
  const renew = verified ? fmtDate(addYear(m.verifiedOn)) : '—';
  document.querySelectorAll('[data-renew]').forEach((el) => (el.textContent = renew));
  document.querySelector('.dhead__status .verified-line').hidden = !verified;
  const edit = document.querySelector('.dhead__actions a.btn--ink'); if (edit) edit.href = href(`/members/${m.id}/`);
  const mount = document.querySelector('[data-idcard-mount]');
  mount.innerHTML = idCard(m, { href: false, stamp: verified });
  if (!verified) mount.querySelector('.seal')?.remove();

  /* the record, from what actually happened */
  const events = [['Account created', day(m.createdAt), verified ? 'Profile published to the directory as a verified member.' : 'Profile created. It appears in the directory once verified.']];
  if (v) {
    events.push(['Application submitted', day(v.submittedAt), `Reference ${v.reference}. ${v.documents ? `${v.documents} document${v.documents === 1 ? '' : 's'} on file.` : 'No document on file yet.'}`]);
    if (v.reviewStartedAt) events.push(['Human review started', day(v.reviewStartedAt), 'Assigned to a reviewer. Registry and DNS checks run.']);
    if (v.status === 'rejected' && v.decidedAt) events.push(['Application declined', day(v.decidedAt), v.note || 'The reason is in your email. You can apply again once it is fixed.']);
  }
  if (verified) { events.push(['Stamp issued', m.verifiedOn, 'Trulinq Verified stamp added to your photo. Score activated.'], ['Next re-verification', addYear(m.verifiedOn), 'We check again so stamps never outlive a business.']); }
  else if (!v || v.status === 'rejected') events.push(['Verification', '', 'Start your application from Get verified to earn the stamp.']);
  const tl = document.querySelector('[data-timeline]');
  events.forEach(([title, date, note]) => {
    const cls = date && date <= today() ? 'is-done' : 'is-future';
    tl.insertAdjacentHTML('beforeend', `<li class="tl ${cls}" data-tl><span class="tl__title">${title}</span><time class="tl__date" datetime="${date}">${date ? fmtDate(date) : 'Not started'}</time><span class="tl__note">${note}</span></li>`);
  });
  const done = [...tl.querySelectorAll('.tl.is-done')]; if (done.length) done[done.length - 1].classList.add('is-now');

  document.querySelector('[data-gauge-mount]').innerHTML = gaugeHTML({ caption: `${m.name} · ${m.company || 'No business yet'}` });
  document.querySelector('[data-factors-mount]').innerHTML = factorsHTML(m);

  /* documents on file, from the latest application */
  const docs = document.querySelectorAll('.docs .doc');
  const setDoc = (li, detail, label, pillClass, date) => { li.querySelector('.doc__body span').textContent = detail; const p = li.querySelector('.pill'); p.textContent = label; p.className = `pill ${pillClass} pill--sm`; li.querySelector('.doc__date').textContent = date ? fmtDate(day(date)) : '—'; };
  if (v) {
    setDoc(docs[0], `${v.identity.idType || 'ID'} · ${v.identity.country || ''}`.replace(/ · $/, ''), v.documents ? REQ_LABEL[v.status] : 'Not uploaded', v.documents ? REQ_PILL[v.status] : 'pill--sand', v.submittedAt);
    setDoc(docs[1], [v.business.name, v.business.registration].filter(Boolean).join(' · ') || '—', REQ_LABEL[v.status], REQ_PILL[v.status], v.submittedAt);
  } else {
    setDoc(docs[0], 'Not submitted yet', 'Missing', 'pill--sand', null);
    setDoc(docs[1], 'Not submitted yet', 'Missing', 'pill--sand', null);
  }
  const webPts = m.factors[2];
  setDoc(docs[2], m.website || 'No website linked', m.website ? (webPts === 15 ? 'Confirmed' : 'Linked') : 'None', m.website ? (webPts === 15 ? 'pill--mint' : 'pill--sky') : 'pill--sand', verified ? m.verifiedOn : (v && v.submittedAt) || null);

  const vouches = me.endorsements || [];
  document.querySelector('[data-vouch-count]').textContent = `(${vouches.length})`;
  document.querySelector('[data-vouches]').innerHTML = vouches.map((e) => `<figure class="vouch-card"><blockquote>${e.text}</blockquote><figcaption><a href="${href(`/members/${e.from.id}/`)}"><img class="avatar" src="${photo(e.from.photo, 96)}" alt=""><span><b>${e.from.name}</b>${e.from.role}, ${e.from.company}</span></a><span class="seal seal--sm is-static" data-quiet>${sealSVG()}</span><time datetime="${e.date}">${fmtDate(e.date)}</time></figcaption></figure>`).join('') || `<div class="empty"><h3>No endorsements yet.</h3><p>Ask someone you’ve worked with to vouch for you.</p></div>`;
  document.querySelector('[data-posts]').innerHTML = (me.posts || []).map((p) => postHTML(p, m)).join('') || `<div class="empty"><h3>No posts yet.</h3><p>The feed is chronological. Your first post goes straight to the top.</p></div>`;

  /* profile completeness, from the record */
  const keys = ['photo', 'bio', 'industry', 'city', 'website', 'founded', 'offers', 'looking'];
  document.querySelectorAll('[data-checklist] li').forEach((li, i) => li.toggleAttribute('data-done', !!(m.completeness || {})[keys[i]]));

  /* billing, only what is known */
  const sub = me.subscription;
  const rows = document.querySelectorAll('.rail__ledger .ledger__row b');
  if (rows.length >= 4) {
    rows[0].textContent = sub ? ({ verified_business: 'Verified Business', member: 'Member', enterprise: 'Enterprise' })[sub.plan] || sub.plan : 'No plan yet';
    rows[1].textContent = sub ? (sub.period === 'monthly' ? '$24 / month' : '$228 / year') : '—';
    rows[2].textContent = sub && sub.current_period_end ? fmtDate(sub.current_period_end) : '—';
    rows[3].textContent = sub && sub.card_last4 ? `•••• ${sub.card_last4}` : '—';
  }

  document.querySelector('[data-letter]').addEventListener('click', () => toast(verified ? 'Verification letters are not generated yet. Write to support@trulinq.com and a person sends one.' : 'A verification letter is issued once your stamp is active.'));
  document.querySelector('[data-card]').addEventListener('click', () => toast('Billing is not connected on this deployment yet.'));
  document.querySelectorAll('[data-replace]').forEach((b) => b.addEventListener('click', () => toast(`Replacing your ${b.dataset.replace} starts a fresh review. Submit a new application from Get verified.`)));
  const confirm = document.querySelector('[data-confirm]');
  document.querySelector('[data-cancel]').addEventListener('click', () => { confirm.hidden = false; if (!reduced) gsap.from(confirm, { y: -8, opacity: 0, duration: .5, ease: 'expo.out' }); });
  document.querySelector('[data-confirm-no]').addEventListener('click', () => (confirm.hidden = true));
  document.querySelector('[data-confirm-yes]').addEventListener('click', () => { confirm.hidden = true; toast(sub ? `Noted. Your stamp stays active until ${renew}.` : 'There is no plan to cancel yet.'); });

  /* sign out lives with the other account links */
  const privacy = document.querySelector('.rail.card--ink');
  privacy.insertAdjacentHTML('beforeend', `<a class="rail__link" href="${href('/')}" data-signout>Sign out <i>→</i></a>`);
  privacy.querySelector('[data-signout]').addEventListener('click', async (e) => { e.preventDefault(); try { await api.post('/auth/logout'); } catch { /* the cookie is cleared server-side or already gone */ } go(href('/'), 'Trulinq'); });
}

function hero() {
  if (!me) return;
  const m = me.member;
  const items = document.querySelectorAll('[data-tl]');
  const line = document.querySelector('[data-timeline-line]');
  const doneCount = document.querySelectorAll('.tl.is-done').length;
  if (!reduced) {
    ScrollTrigger.create({ trigger: '[data-timeline]', start: 'top 80%', once: true, onEnter: () => {
      gsap.to(line, { scaleY: Math.min(1, Math.max(0, (doneCount - .5) / Math.max(1, items.length - 1))), duration: 1.6, ease: 'power2.inOut' });
      items.forEach((it, i) => gsap.fromTo(it, { x: -14, opacity: 0 }, { x: 0, opacity: 1, duration: .9, ease: 'expo.out', delay: i * .18, clearProps: 'opacity,transform' }));
    } });
    gsap.set(items, { opacity: 0 });
  }
  ScrollTrigger.create({ trigger: '[data-timeline]', start: 'top 80%', once: true, onEnter: () => items.forEach((it, i) => setTimeout(() => it.classList.add('is-seen'), reduced ? 0 : 200 + i * 180)) });

  const seal = document.querySelector('[data-idcard-mount] .seal');
  if (seal) { seal.setAttribute('data-manual', ''); stamp(seal, { delay: .6, rotate: -6 }); }
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
