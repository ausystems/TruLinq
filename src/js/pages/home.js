import '../../styles/main.css';
import '../../styles/pages/home.css';
import { boot, gsap, stamp, reduced, isTouch, whenVisible } from '../main.js';
import { idCard, portrait, seal, esc, href, fmtDate, relTime } from '../ui.js';
import { loadMembers, loadStats, loadRooms } from '../data.js';
import { FEATURED, QUOTES } from '../../data/editorial.js';
import { gaugeHTML, factorsHTML, runGauge } from '../gauge.js';
import { createStamp } from '../stamp3d.js';

let members = [], byId = {};
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
    document.querySelector('[data-hero-card]').innerHTML = idCard(lead, { link: false, stamp: 'manual', sealSize: 'md' });
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

  document.querySelector('[data-room-list]').innerHTML = rooms.slice(0, 4).map((r) => `<li>${esc(r.name)}${r.lastMessageAt ? `<span>active ${relTime(r.lastMessageAt)}</span>` : ''}</li>`).join('');
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
  const stacked = matchMedia('(max-width: 1023px)');

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

  if (reduced) { sealEl.classList.add('is-stamped'); return; }

  /* the impact: the seal lands, the card takes the hit */
  const thud = () => {
    if (!sealEl.classList.contains('is-stamped')) stamp(sealEl, { rotate: -7 });
    else gsap.fromTo(sealEl, { scale: .88 }, { scale: 1, duration: .8, ease: 'elastic.out(1, .45)' });
    gsap.timeline().to(card, { y: 8, duration: .1, ease: 'power2.out' }).to(card, { y: 0, duration: .8, ease: 'elastic.out(1, .45)' });
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

/* ── Globe: members who list a city, grouped where they are close together ── */
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

async function globe() {
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

  let THREE;
  try { THREE = await import('../three-lite.js'); }
  catch { wrap.hidden = true; return; }
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); }
  catch { sphere.hidden = true; return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, 0, 4.1);
  const group = new THREE.Group();
  scene.add(group);

  const toVec = (lat, lng, r = 1) => {
    const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  };

  /* an occluder, then a globe drawn only in dots */
  group.add(new THREE.Mesh(new THREE.SphereGeometry(.985, 64, 64), new THREE.MeshBasicMaterial({ color: 0xFFFFFF })));
  const N = isTouch ? 1600 : 3000;
  const pos = new Float32Array(N * 3), golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = golden * i;
    pos[i * 3] = Math.cos(th) * rr; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(th) * rr;
  }
  const dotsGeo = new THREE.BufferGeometry(); dotsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  group.add(new THREE.Points(dotsGeo, new THREE.PointsMaterial({ color: 0x2981FB, size: .018, sizeAttenuation: true, transparent: true, opacity: .5 })));
  const cityGeo = new THREE.SphereGeometry(.014, 12, 12), cityMat = new THREE.MeshBasicMaterial({ color: 0x0C1526 });
  located.forEach((m) => { const s = new THREE.Mesh(cityGeo, cityMat); s.position.copy(toVec(m.lat, m.lng, 1.005)); group.add(s); });

  pinsEl.innerHTML = groups.map((g, i) => {
    const one = g.members.length === 1;
    return `<div class="pin ${g.hq ? 'pin--hq' : ''}" data-pin="${i}"><span class="pin__faces">${g.members.slice(0, 3).map((m) => portrait(m, { size: 26 })).join('')}</span><span>${esc(g.label)} <em>${one ? esc(g.members[0].first) : `${g.members.length} members`}</em></span></div>`;
  }).join('');
  const pinEls = [...pinsEl.querySelectorAll('[data-pin]')];
  const pinVecs = groups.map((g) => toVec(g.lat, g.lng, 1.02));

  /* face the middle of the pins: turn to their longitude, tilt to their latitude */
  const mid = { lat: groups.reduce((a, g) => a + g.lat, 0) / groups.length, lng: groups.reduce((a, g) => a + g.lng, 0) / groups.length };
  const mv = toVec(0, mid.lng);
  group.rotation.y = -Math.atan2(mv.x, mv.z);
  group.rotation.x = mid.lat * Math.PI / 180 * .8;

  const resize = () => { const w = sphere.clientWidth, h = sphere.clientHeight || w; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); render(); };
  const v = new THREE.Vector3(), camDir = new THREE.Vector3();
  function render() {
    renderer.render(scene, camera);
    const w = sphere.clientWidth, h = sphere.clientHeight;
    group.updateMatrixWorld();
    camDir.copy(camera.position).normalize();
    pinVecs.forEach((pv, i) => {
      v.copy(pv).applyMatrix4(group.matrixWorld);
      const facing = v.clone().normalize().dot(camDir);
      v.project(camera);
      const x = (v.x * .5 + .5) * w, y = (-v.y * .5 + .5) * h - 22;
      const vis = facing > .12, el = pinEls[i];
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%) scale(${vis ? (.85 + facing * .2).toFixed(3) : .6})`;
      el.style.opacity = vis ? Math.min(1, (facing - .12) * 4).toFixed(2) : 0;
      el.style.zIndex = Math.round(facing * 100);
    });
  }
  resize(); new ResizeObserver(resize).observe(sphere);

  /* drag to turn; it renders only while it moves */
  let raf = null, velocity = 0, dragging = false, lastX = 0;
  const tick = () => {
    raf = null;
    if (!dragging) { group.rotation.y += velocity; velocity *= .92; }
    render();
    if (dragging || Math.abs(velocity) > .0002) raf = requestAnimationFrame(tick);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; velocity = 0; canvas.classList.add('is-dragging'); canvas.setPointerCapture?.(e.pointerId); kick(); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; group.rotation.y += dx * .005; velocity = reduced ? 0 : dx * .0005; });
  const up = () => { if (!dragging) return; dragging = false; canvas.classList.remove('is-dragging'); kick(); };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
}

boot(build, () => {
  hero();
  how();
  whenVisible(document.querySelector('[data-globe]'), globe, { rootMargin: '400px 0px' });
});
