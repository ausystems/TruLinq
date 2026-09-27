import '../../styles/main.css';
import '../../styles/pages/home.css';
import { boot, gsap, stamp, reduced, isTouch, whenVisible, introDone } from '../main.js';
import { idCard, portrait, seal, esc, href, fmtDate, relTime } from '../ui.js';
import { loadMembers, loadStats, loadRooms } from '../data.js';
import { FEATURED, QUOTES } from '../../data/editorial.js';
import { gaugeHTML, factorsHTML, runGauge } from '../gauge.js';
import { createStamp } from '../stamp3d.js';
import { LAND } from '../../data/land.js';

let members = [], byId = {};
/* the reviewer's note beside the hero card: written once the stamp has landed */
const HERO_NOTE = `<p class="scribble hero__note" aria-hidden="true" data-manual><span class="scribble__text">checked by a person</span><svg class="scribble__pen" style="--pen-w:52px" viewBox="0 0 80 48"><path pathLength="1" d="M8 44c14-4 30-16 44-36"/><path pathLength="1" d="M40 12l13-5 3 13"/></svg></p>`;
const job = (m) => [m.role, m.company].filter(Boolean).join(', ') || m.headline || '';

const STAT_LABELS = {
  people: ['person on Trulinq', 'people on Trulinq'],
  verified: ['verified profile', 'verified profiles'],
  posts: ['post shared', 'posts shared'],
  revoked: ['stamp revoked', 'stamps revoked']
};
function paintStats(st) {
  Object.entries(STAT_LABELS).forEach(([k, [one, many]]) => {
    const b = document.querySelector(`[data-stat="${k}"]`), l = document.querySelector(`[data-stat-label="${k}"]`);
    if (!b || st[k] == null) return;
    b.textContent = st[k];
    if (l) l.textContent = st[k] === 1 ? one : many;
  });
}

/* ── Data-driven parts of the page ───────────────────────────── */
async function build() {
  const [data, stats, rooms] = await Promise.all([loadMembers(), loadStats().catch(() => null), loadRooms().catch(() => [])]);
  ({ members, byId } = data);
  if (stats) paintStats(stats);

  /* how many verified members work in each industry */
  const counts = {};
  members.forEach((m) => { if (m.industry) counts[m.industry] = (counts[m.industry] || 0) + 1; });
  document.querySelectorAll('[data-industry-tag]').forEach((a) => {
    const n = counts[a.dataset.industryTag] || 0;
    if (!n) return;
    a.insertAdjacentHTML('beforeend', `<span class="who__count" aria-hidden="true">${n}</span>`);
    a.setAttribute('aria-label', `${a.textContent.replace(/\d+$/, '').trim()}, ${n} verified member${n === 1 ? '' : 's'}`);
  });

  const lead = byId[FEATURED.hero] || members[0];
  if (lead) {
    document.querySelector('[data-hero-card]').innerHTML = idCard(lead, { link: false, stamp: 'manual', sealSize: 'md' }) + HERO_NOTE;
    document.querySelector('[data-hero-caption]').innerHTML = `<a class="link" href="${href(`/members/${lead.id}/`)}">${esc(lead.name)}</a>${job(lead) ? ` · ${esc(job(lead))}` : ''}${lead.verifiedOn ? ` · Verified ${fmtDate(lead.verifiedOn)}` : ''}`;
  }

  document.querySelector('[data-world-cards]').innerHTML = FEATURED.world.map((id) => byId[id]).filter(Boolean).map((m) => idCard(m)).join('');

  const scored = byId[FEATURED.score] || members[0];
  if (scored) {
    document.querySelector('[data-gauge-mount]').innerHTML = gaugeHTML({ caption: [scored.name, scored.company].filter(Boolean).join(' · '), href: href(`/members/${scored.id}/`) });
    document.querySelector('[data-factors-mount]').innerHTML = factorsHTML(scored);
    runGauge(document.querySelector('[data-gauge-root]'), scored.factors, { trigger: document.querySelector('[data-gauge-mount]') });
  }

  const quotes = QUOTES.map((q) => ({ ...q, m: byId[q.member] })).filter((q) => q.m);
  document.querySelector('[data-quotes]').innerHTML = quotes.map(({ text, m }) => `<figure class="quote">
      <blockquote><p>“${esc(text)}”</p></blockquote>
      <figcaption><a href="${href(`/members/${m.id}/`)}">${portrait(m, { size: 40, cls: 'avatar' })}<span><b>${esc(m.name)}</b>${esc(job(m))}</span></a>${seal({ size: 'sm' })}</figcaption>
    </figure>`).join('');
  if (!quotes.length) document.querySelector('.quotes').hidden = true;

  /* each room gets the seal its speakers carry; hovering the card stamps them in, one by one */
  document.querySelector('[data-room-list]').innerHTML = rooms.slice(0, 4).map((r, i) => `<li style="--i:${i}"><b>${esc(r.name)}</b>${r.lastMessageAt ? `<span>active ${relTime(r.lastMessageAt)}</span>` : ''}<span class="seal seal--xs"></span></li>`).join('');
}

/* ── Hero: the stamp presses the seal onto a real member's card ── */
async function hero() {
  const stage = document.querySelector('[data-hero-stage]');
  const desk = stage.querySelector('.hero__desk');
  const cardWrap = stage.querySelector('[data-hero-card]');
  const card = cardWrap.querySelector('.idcard');
  if (!card) return;
  const sealEl = card.querySelector('.seal');
  const canvas = stage.querySelector('[data-hero-stamp]');
  const note = cardWrap.querySelector('.hero__note');
  const stacked = matchMedia('(max-width: 1023px)');
  const write = () => note && note.classList.add('is-written');

  /* the headline's full stop is the seal, pressed as the page arrives (after the intro, when there is one) */
  introDone.then(() => stamp(document.querySelector('[data-hero-stop]'), { delay: .1, rotate: -12 }));

  /* the card lies on the desk */
  gsap.set(card, { rotationX: 34, rotationZ: -6, rotationY: 4, transformPerspective: 1400, transformOrigin: '50% 50%' });

  let S;
  try {
    S = await createStamp(canvas, desk, {
      mode: 'straight', fov: 30, camPos: [0, 3.6, 9.4], look: [0, .8, 0], scale: .56,
      rest: { x: -.32, y: -.7, z: .08 }, restY: .95, dropY: 1, shadowY: -.02, shadowOpacity: .05, position: [-.1, 0, .4]
    });
  } catch (e) {
    /* no WebGL: the card is shown on its own, already stamped */
    console.info('[trulinq] 3D stamp unavailable', e);
    canvas.remove();
    Object.assign(cardWrap.style, { left: '50%', top: '46%', transform: 'translate(-50%, -50%)' });
    if (sealEl) sealEl.classList.add('is-stamped');
    cardWrap.classList.add('is-placed');
    write();
    return;
  }

  const BASE_X = -.1, LAND = [BASE_X, -.06, .4];
  /* put the card's seal exactly under the stamp's landing spot (desk pixels) */
  const place = () => {
    const land = S.project(...LAND);
    const hr = desk.getBoundingClientRect(), sr = sealEl.getBoundingClientRect(), wr = cardWrap.getBoundingClientRect();
    cardWrap.style.left = `${(wr.left - hr.left) + (land.x - (sr.left + sr.width / 2 - hr.left))}px`;
    cardWrap.style.top = `${(wr.top - hr.top) + (land.y - (sr.top + sr.height / 2 - hr.top))}px`;
  };
  /* Frame the desk for the layout, then keep the whole card inside it: if it would run past an edge, the stamp and
     its landing spot slide over with it, so the seal still lands exactly under the press. */
  const shift = (du) => { LAND[0] = BASE_X + du; S.group.position.x = BASE_X + du; S.shadow.position.x = BASE_X + du; };
  const frame = () => {
    S.resize();
    S.camera.lookAt(0, stacked.matches ? .38 : .8, 0);
    S.camera.updateMatrixWorld();
    shift(0); place();
    const hr = desk.getBoundingClientRect(), cr = card.getBoundingClientRect(), pad = 6;
    const dx = cr.right > hr.right - pad ? (hr.right - pad) - cr.right : cr.left < hr.left + pad ? (hr.left + pad) - cr.left : 0;
    if (dx) { const a = S.project(...LAND), b = S.project(LAND[0] + 1, LAND[1], LAND[2]); shift(dx / (b.x - a.x)); place(); }
    S.render();
    cardWrap.classList.add('is-placed');
  };
  frame();
  new ResizeObserver(frame).observe(desk);

  if (reduced) { sealEl.classList.add('is-stamped'); write(); return; }

  /* the impact: the seal lands, the card takes the hit */
  const thud = () => {
    if (!sealEl.classList.contains('is-stamped')) stamp(sealEl, { rotate: -7 });
    else gsap.fromTo(sealEl, { scale: .88 }, { scale: 1, duration: .8, ease: 'elastic.out(1, .45)' });
    gsap.timeline().to(card, { y: 8, duration: .1, ease: 'power2.out' }).to(card, { y: 0, duration: .8, ease: 'elastic.out(1, .45)' });
    setTimeout(write, 350);
  };
  let pressing = false;
  const press = (delay = 0) => {
    pressing = true;
    S.play(delay + 1.8);
    gsap.timeline({ delay, onComplete: () => (pressing = false) })
      .to(S.press, { t: 1, duration: .36, ease: 'power3.in' })
      .add(thud)
      .to(S.press, { t: 0, duration: 1.1, ease: 'elastic.out(1, .45)' }, '+=.08');
  };

  /* the card is set down, the stamp presses once; beside the copy that happens on arrival, stacked under it the
     press waits until the desk is on screen */
  gsap.fromTo(cardWrap, { opacity: 0 }, { opacity: 1, duration: .5, ease: 'power2.out' });
  whenVisible(stage, () => press(.55), { rootMargin: '0px 0px -20% 0px' });

  /* press it again: a mouse on press, a finger on tap (so a scroll that starts here never fires it) */
  stage.classList.add('is-pressable');
  stage.addEventListener(isTouch ? 'click' : 'pointerdown', (e) => {
    if (e.button || pressing || !sealEl.classList.contains('is-stamped')) return;
    press(0);
  });
}

/* ── How it works: one application moving through the three checks, played once ── */
function how() {
  const section = document.querySelector('[data-how]');
  const steps = [...section.querySelectorAll('[data-step]')];
  const status = section.querySelector('[data-how-status]');
  const sealEl = section.querySelector('[data-how-seal]');
  const finish = () => {
    steps.forEach((s) => { s.classList.add('is-lit'); s.style.setProperty('--fill', '1'); });
    sealEl.classList.add('is-stamped');
    section.classList.add('is-played');
  };
  if (reduced) { finish(); return; }
  status.textContent = 'In review'; status.classList.add('is-pending');
  steps.forEach((s) => gsap.set(s, { '--fill': 0 }));
  whenVisible(section.querySelector('[data-steps]'), () => {
    const sweep = section.querySelector('[data-sweep]'), match = section.querySelector('[data-match]');
    const rows = [...section.querySelectorAll('[data-row]')];
    const lit = (i) => () => steps[i].classList.add('is-lit');
    const tl = gsap.timeline({ onComplete: () => section.classList.add('is-played') });
    tl.add(lit(0), 0)
      .fromTo(sweep, { xPercent: -80, opacity: 0 }, { xPercent: 460, opacity: 1, duration: 1.2, ease: 'power2.inOut' }, .2)
      .to(sweep, { opacity: 0, duration: .25 }, 1.2)
      .to(match, { opacity: 1, scale: 1, duration: .5, ease: 'back.out(2)' }, 1.15)
      .to(steps[0], { '--fill': 1, duration: .6, ease: 'power2.inOut' }, 1.5)
      .add(lit(1), 2.05);
    rows.forEach((row, i) => {
      tl.to(row, { opacity: 1, duration: .3 }, 2.1 + i * .22)
        .to(row.querySelector('.tick'), { scale: 1, duration: .4, ease: 'back.out(3)' }, 2.2 + i * .22);
    });
    const t3 = 2.3 + rows.length * .22;
    tl.to(steps[1], { '--fill': 1, duration: .6, ease: 'power2.inOut' }, t3)
      .add(lit(2), t3 + .55)
      .add(() => stamp(sealEl, { rotate: -8 }), t3 + .7)
      .add(() => { status.textContent = 'Trulinq Verified'; status.classList.remove('is-pending'); }, t3 + 1.05);
  }, { rootMargin: '0px 0px -25% 0px' });
}

/* ── Globe: members who list a city, grouped where they work close together ── */
const RAD = Math.PI / 180;
const inHawaii = (m) => m.lat > 18.5 && m.lat < 22.6 && m.lng > -160.6 && m.lng < -154.4;
function groupsOf(list) {
  const groups = [];
  for (const m of list) {
    const key = inHawaii(m) ? 'hawaii' : '';
    let g = key ? groups.find((x) => x.key === key) : groups.find((x) => !x.key && Math.hypot(x.members[0].lat - m.lat, x.members[0].lng - m.lng) < 2);
    if (!g) { g = { key, members: [] }; groups.push(g); }
    g.members.push(m);
  }
  for (const g of groups) {
    g.lat = g.members.reduce((a, m) => a + m.lat, 0) / g.members.length;
    g.lng = g.members.reduce((a, m) => a + m.lng, 0) / g.members.length;
    g.label = g.key === 'hawaii' ? 'Hawaiʻi' : g.members[0].city;
    g.hq = g.members.some((m) => m.id === FEATURED.hero);
  }
  return groups.sort((a, b) => b.hq - a.hq || b.members.length - a.members.length);
}

/* The land, as dots: an even grid on the sphere (src/data/land.js), kept where the grid falls on land. */
function landDots() {
  const bytes = Uint8Array.from(atob(LAND.bits), (c) => c.charCodeAt(0));
  const out = [];
  let i = 0;
  for (let lat = 90 - LAND.step / 2; lat > -90; lat -= LAND.step) {
    const n = Math.max(1, Math.round((360 * Math.cos(lat * RAD)) / LAND.step));
    for (let j = 0; j < n; j++, i++) if (bytes[i >> 3] & (1 << (i & 7))) out.push(Math.sin(lat * RAD), Math.cos(lat * RAD), (-180 + ((j + .5) * 360) / n) * RAD);
  }
  return new Float32Array(out);
}

/* An orthographic globe drawn in 2D: a paper sphere, a faint graticule, the land in blue-ink dots and each group of
   members as monograms where they work. It is drawn once, and again only while someone turns it. */
function globe() {
  const wrap = document.querySelector('[data-globe]');
  const sphere = wrap.querySelector('.world__sphere');
  const canvas = wrap.querySelector('[data-globe-canvas]');
  const pinsEl = wrap.querySelector('[data-globe-pins]');
  const located = members.filter((m) => m.lat != null && m.lng != null);
  if (!located.length) { wrap.hidden = true; return; }
  const groups = groupsOf(located);
  const where = groups.map((g) => `${g.label} (${g.members.length})`).join(', ');
  canvas.setAttribute('aria-label', `A globe showing where verified members work: ${where}.`);
  wrap.querySelector('[data-globe-caption]').textContent = `${located.length} of ${members.length} verified members list a city. Each is pinned where they work.${isTouch ? '' : ' Drag to turn the globe.'}`;
  const ctx = canvas.getContext('2d');
  if (!ctx) { sphere.hidden = true; return; }

  const dots = landDots();
  pinsEl.innerHTML = groups.map((g, i) => {
    const one = g.members.length === 1;
    return `<div class="pin ${g.hq ? 'pin--hq' : ''} ${one ? 'pin--solo' : ''}" data-pin="${i}"><span class="pin__faces">${g.members.slice(0, 5).map((m) => portrait(m, { size: 52 })).join('')}</span><span class="pin__label">${esc(g.label)} <em>${one ? esc(g.members[0].first) : `${g.members.length} members`}</em></span></div>`;
  }).join('');
  const pinEls = [...pinsEl.querySelectorAll('[data-pin]')];
  /* each pin is anchored at the middle of its faces, wherever its label sits */
  let anchors = [];
  const measure = () => { anchors = pinEls.map((el) => { const f = el.firstElementChild; return [f.offsetLeft + f.offsetWidth / 2, f.offsetTop + f.offsetHeight / 2]; }); pinEls.forEach((el, i) => (el.style.transformOrigin = `${anchors[i][0]}px ${anchors[i][1]}px`)); };

  /* face the middle of the groups */
  const view = { lng: groups.reduce((a, g) => a + g.lng, 0) / groups.length, lat: Math.max(-40, Math.min(40, groups.reduce((a, g) => a + g.lat, 0) / groups.length - 6)) };
  let W = 0, R = 0, dpr = 1;
  const project = (sinLat, cosLat, lng) => {
    const l0 = view.lng * RAD, p0 = view.lat * RAD, dl = lng - l0, c = Math.cos(dl);
    return [cosLat * Math.sin(dl), Math.cos(p0) * sinLat - Math.sin(p0) * cosLat * c, Math.sin(p0) * sinLat + Math.cos(p0) * cosLat * c];
  };
  const graticule = [];
  for (let lng = -180; lng < 180; lng += 30) { const line = []; for (let lat = -90; lat <= 90; lat += 3) line.push([lat, lng]); graticule.push(line); }
  for (let lat = -60; lat <= 60; lat += 30) { const line = []; for (let lng = -180; lng <= 180; lng += 3) line.push([lat, lng]); graticule.push(line); }

  function draw() {
    const cx = W / 2, cy = W / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);
    /* the paper sphere */
    const shade = ctx.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R);
    shade.addColorStop(0, '#FFFFFF'); shade.addColorStop(.7, '#F7FAFF'); shade.addColorStop(1, '#E7EFFC');
    ctx.fillStyle = shade; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    /* the graticule, front side only */
    ctx.strokeStyle = 'rgba(41, 129, 251, .16)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const line of graticule) {
      let pen = false;
      for (const [lat, lng] of line) {
        const [x, y, z] = project(Math.sin(lat * RAD), Math.cos(lat * RAD), lng * RAD);
        if (z < 0) { pen = false; continue; }
        const px = cx + x * R, py = cy - y * R;
        if (pen) ctx.lineTo(px, py); else { ctx.moveTo(px, py); pen = true; }
      }
    }
    ctx.stroke();
    /* the land, in four shades of ink by how directly it faces us */
    const base = R * .0068, buckets = [[], [], [], []];
    for (let k = 0; k < dots.length; k += 3) {
      const [x, y, z] = project(dots[k], dots[k + 1], dots[k + 2]);
      if (z <= .02) continue;
      buckets[Math.min(3, Math.floor(z * 4))].push(cx + x * R, cy - y * R, base * (.55 + .45 * z));
    }
    buckets.forEach((b, i) => {
      ctx.fillStyle = `rgba(23, 102, 230, ${[.36, .56, .78, .95][i]})`;
      ctx.beginPath();
      for (let k = 0; k < b.length; k += 3) { ctx.moveTo(b[k] + b[k + 2], b[k + 1]); ctx.arc(b[k], b[k + 1], b[k + 2], 0, Math.PI * 2); }
      ctx.fill();
    });
    /* the rim */
    ctx.strokeStyle = 'rgba(10, 22, 51, .08)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R - .5, 0, Math.PI * 2); ctx.stroke();
    /* the members */
    groups.forEach((g, i) => {
      const [x, y, z] = project(Math.sin(g.lat * RAD), Math.cos(g.lat * RAD), g.lng * RAD);
      const el = pinEls[i], vis = z > .15, [ax, ay] = anchors[i];
      const px = cx + x * R - ax, py = cy - y * R - ay;
      el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) scale(${vis ? (.86 + z * .14).toFixed(3) : .6})`;
      el.style.opacity = vis ? Math.min(1, (z - .15) * 5).toFixed(2) : 0;
      el.style.zIndex = Math.round(z * 100);
    });
  }
  const resize = () => {
    W = sphere.clientWidth; R = W * .44; dpr = Math.min(window.devicePixelRatio || 1, 2); measure();
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(W * dpr);
    draw();
  };
  resize(); new ResizeObserver(resize).observe(sphere);

  /* drag to turn; it redraws only while it moves */
  let raf = null, velocity = 0, dragging = false, lastX = 0;
  const tick = () => {
    raf = null;
    if (!dragging) { view.lng -= velocity; velocity *= .92; }
    draw();
    if (dragging || Math.abs(velocity) > .01) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; velocity = 0; canvas.classList.add('is-dragging'); canvas.setPointerCapture?.(e.pointerId); kick(); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; const deg = (dx / R) / RAD; view.lng -= deg; velocity = reduced ? 0 : deg * .9; });
  const up = () => { if (!dragging) return; dragging = false; canvas.classList.remove('is-dragging'); kick(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
}

boot(build, () => {
  hero();
  how();
  /* touch screens have no hover: each feature card plays its scene once, as it comes into view */
  if (isTouch) document.querySelectorAll('.bento__card').forEach((card) => whenVisible(card, () => card.classList.add('is-live'), { rootMargin: '0px 0px -30% 0px' }));
  whenVisible(document.querySelector('[data-globe]'), globe, { rootMargin: '400px 0px' });
});
