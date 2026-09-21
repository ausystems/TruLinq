import '../../styles/main.css';
import '../../styles/pages/home.css';
import { boot, gsap, ScrollTrigger, stamp, reduced, isTouch, hydrateSeals, popIn, suspend, scrollTo } from '../main.js';
import { idCard, photo, scoreOf, gradeOf, pct } from '../ui.js';
import { byId, SCENES } from '../../data/members.js';
import { gaugeHTML, factorsHTML, runGauge } from '../gauge.js';

/* ── Build DOM that depends on data ──────────────────────────── */
function build() {
  const kai = byId['kai-nakamura'], amara = byId['amara-cole'], leilani = byId['leilani-akana'], grace = byId['grace-okafor'];

  const cards = document.querySelector('[data-cards]');
  cards.innerHTML = idCard(kai, { stamp: true }) + idCard(amara, { stamp: true });
  cards.querySelectorAll('.seal').forEach((s) => s.setAttribute('data-manual', ''));
  cards.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; img.fetchPriority = 'high'; });

  const howCard = document.querySelector('[data-how-card]');
  howCard.innerHTML = idCard(kai, { href: false, stamp: true });
  howCard.querySelector('.seal').setAttribute('data-manual', '');

  document.querySelector('[data-world-cards]').innerHTML = idCard(leilani) + idCard(grace);

  const masked = document.querySelector('[data-masked]');
  masked.style.setProperty('--mask-img', `url(${photo(SCENES.team, 1600, 1000)})`);

  document.querySelector('[data-gauge-mount]').innerHTML = gaugeHTML({ caption: 'Kai Nakamura · Pacific Reef Ventures' });
  document.querySelector('[data-factors-mount]').innerHTML = factorsHTML(kai);
}

/* ── Hero choreography ───────────────────────────────────────── */
function hero() {
  const heroEl = document.querySelector('[data-hero]');
  const cards = heroEl.querySelectorAll('[data-cards] .idcard');
  const seal = heroEl.querySelector('.hero__seal');
  const under = heroEl.querySelector('.hero__underline path');
  /* pin the seal to the top-right corner of the word "real" (the line boxes clip overflow) */
  const placeSeal = () => {
    const title = heroEl.querySelector('.hero__title');
    const word = heroEl.querySelector('.hero__real');
    const size = seal.offsetWidth || 48;
    let top = 0, left = 0, el = word;
    while (el && el !== title) { top += el.offsetTop; left += el.offsetLeft; el = el.offsetParent; }
    seal.style.left = `${left + word.offsetWidth - size * .22}px`;
    seal.style.top = `${top - size * .62}px`;
  };
  placeSeal(); window.addEventListener('resize', placeSeal);
  if (reduced) {
    gsap.set('.hero__line > span', { y: 0 }); gsap.set('.hero__eyebrow, .hero__lead, .hero__cta', { opacity: 1 });
    gsap.set(under, { strokeDashoffset: 0 }); seal.classList.add('is-stamped');
    const wideR = matchMedia('(min-width: 1024px)').matches;
    gsap.set(cards[0], { xPercent: wideR ? -8 : -2, yPercent: wideR ? -26 : -30, rotate: wideR ? -5 : -3, opacity: 1 }); gsap.set(cards[1], { xPercent: wideR ? 10 : 4, yPercent: wideR ? 30 : 26, rotate: wideR ? 3.5 : 2.5, opacity: 1 });
    cards.forEach((c) => c.querySelector('.seal').classList.add('is-stamped'));
    return;
  }
  suspend(cards);
  const wide = matchMedia('(min-width: 1024px)').matches;
  gsap.set(cards[0], { xPercent: wide ? -8 : -2, yPercent: wide ? -26 : -30, rotate: wide ? -5 : -3, y: 90, opacity: 0 });
  gsap.set(cards[1], { xPercent: wide ? 10 : 4, yPercent: wide ? 30 : 26, rotate: wide ? 3.5 : 2.5, y: 120, opacity: 0 });
  gsap.set(['.hero__lead', '.hero__cta'], { y: 24 });
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.hero__eyebrow', { opacity: 1, duration: .9 }, 0)
    .to('.hero__line > span', { y: 0, duration: 1.4, stagger: .13 }, .05)
    .to(under, { strokeDashoffset: 0, duration: .75, ease: 'power2.inOut' }, .95)
    .add(() => stamp(seal, { rotate: -9 }), 1.3)
    .to('.hero__lead', { opacity: 1, y: 0, duration: 1.1 }, .75)
    .to('.hero__cta', { opacity: 1, y: 0, duration: 1.1 }, .9)
    .to(cards[0], { y: 0, opacity: 1, duration: 1.5 }, .55)
    .to(cards[1], { y: 0, opacity: 1, duration: 1.5 }, .75)
    .add(() => stamp(cards[0].querySelector('.seal'), { rotate: -7 }), 1.55)
    .add(() => stamp(cards[1].querySelector('.seal'), { rotate: -5 }), 1.85)
    /* after the entrance the cards breathe: a slow, out-of-phase float */
    .add(() => { gsap.to(cards[0], { y: -7, duration: 3.6, ease: 'sine.inOut', yoyo: true, repeat: -1 }); gsap.to(cards[1], { y: 6, duration: 4.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: .6 }); }, 2.3);

  /* pointer parallax on the stage */
  if (!isTouch) {
    const stage = heroEl.querySelector('[data-hero-stage]');
    const qx = [gsap.quickTo(cards[0], 'x', { duration: 1.2, ease: 'power3.out' }), gsap.quickTo(cards[1], 'x', { duration: 1.4, ease: 'power3.out' })];
    const qr = [gsap.quickTo(cards[0], 'rotate', { duration: 1.2, ease: 'power3.out' }), gsap.quickTo(cards[1], 'rotate', { duration: 1.4, ease: 'power3.out' })];
    heroEl.addEventListener('pointermove', (e) => {
      if (tl.isActive()) return;
      const r = stage.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      qx[0](dx * -16); qr[0](-5 + dy * -2); qx[1](dx * 22); qr[1](3.5 + dy * 2);
    });
    heroEl.addEventListener('pointerleave', () => { qx[0](0); qr[0](-5); qx[1](0); qr[1](3.5); });
  }
}

/* ── Scene animations for “How it works” ─────────────────────── */
function sceneId({ withEntrance = true } = {}) {
  const s = document.querySelector('[data-scene="0"]');
  const tl = gsap.timeline({ paused: true });
  if (withEntrance) tl.fromTo(s.querySelector('.iddoc'), { y: 50, rotate: -5, opacity: 0 }, { y: 0, rotate: -1.5, opacity: 1, duration: 1, ease: 'expo.out' });
  else gsap.set(s.querySelector('.iddoc'), { rotate: -1.5 });
  tl.fromTo(s.querySelector('[data-sweep]'), { xPercent: -80, opacity: 0 }, { xPercent: 420, opacity: 1, duration: 1.4, ease: 'power2.inOut' }, withEntrance ? .5 : 0)
    .to(s.querySelector('[data-sweep]'), { opacity: 0, duration: .3 }, withEntrance ? 1.6 : 1.1)
    .to(s.querySelector('[data-match]'), { scale: 1, opacity: 1, duration: .7, ease: 'back.out(2)' }, withEntrance ? 1.5 : 1);
  return tl;
}
function sceneRegistry() {
  const s = document.querySelector('[data-scene="1"]');
  const rows = s.querySelectorAll('[data-row]');
  const tl = gsap.timeline({ paused: true });
  tl.fromTo(s.querySelector('.registry'), { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'expo.out' });
  rows.forEach((row, i) => {
    tl.to(row, { opacity: 1, duration: .4 }, .5 + i * .38)
      .to(row.querySelector('.registry__ok'), { scale: 1, duration: .5, ease: 'back.out(3)' }, .7 + i * .38);
  });
  return tl;
}
function sceneStamp() {
  const s = document.querySelector('[data-scene="2"]');
  const card = s.querySelector('.idcard');
  const seal = s.querySelector('.seal');
  const tl = gsap.timeline({ paused: true });
  tl.fromTo(card, { y: 60, rotate: -8, opacity: 0 }, { y: 0, rotate: -3, opacity: 1, duration: 1, ease: 'expo.out' })
    .fromTo(seal, { opacity: 0, scale: 2.2, rotate: -26 }, { opacity: 1, scale: 1, rotate: -8, duration: .55, ease: 'power4.in' }, .9)
    .to(card, { rotate: -1.5, y: 6, duration: .18, ease: 'power2.out' }, 1.42)
    .to(card, { y: 0, duration: .8, ease: 'elastic.out(1, .4)' }, 1.6)
    .to(seal, { scale: 1.04, duration: .8, ease: 'elastic.out(1, .4)' }, 1.45);
  return tl;
}

function how() {
  const section = document.querySelector('[data-how]');
  const steps = section.querySelectorAll('[data-step]');
  const scenes = section.querySelectorAll('[data-scene]');
  const progress = section.querySelector('[data-how-progress]');
  const setStep = (i) => steps.forEach((s, j) => { s.classList.toggle('is-active', i === j); s.setAttribute('aria-current', i === j ? 'step' : 'false'); });

  const mm = gsap.matchMedia();

  /* Desktop: one pinned stage, three scenes scrubbed by scroll */
  mm.add('(min-width: 1024px)', () => {
    const a = sceneId({ withEntrance: false }), b = sceneRegistry(), c = sceneStamp();
    gsap.set(scenes, { opacity: 0, y: 0 }); gsap.set(scenes[0], { opacity: 1 });
    /* the document is already on the desk when the stage pins */
    const entrance = gsap.fromTo(scenes[0].querySelector('.iddoc'), { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, ease: 'expo.out', paused: true });
    const enterTrig = ScrollTrigger.create({ trigger: section, start: 'top 70%', once: true, onEnter: () => entrance.play() });
    if (reduced) { entrance.progress(1); }
    if (reduced) {
      [a, b, c].forEach((t) => t.progress(1));
      gsap.set(scenes, { opacity: 1, position: 'relative' }); gsap.set('.how__frame', { display: 'grid', gap: 20, padding: 20, height: 'auto' });
      setStep(-1); return;
    }
    let cuts = [0, 1];
    const master = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top top', end: '+=260%', pin: true, pinSpacing: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => { gsap.set(progress, { scaleX: self.progress }); setStep(self.progress < cuts[0] ? 0 : self.progress < cuts[1] ? 1 : 2); } }
    });
    master.addLabel('one').add(a.play(), 'one')
      .to({}, { duration: .5 })
      .to(scenes[0], { opacity: 0, y: -30, duration: .35, ease: 'power2.in' })
      .addLabel('two').set(scenes[1], { opacity: 1 }).add(b.play(), 'two')
      .to({}, { duration: .5 })
      .to(scenes[1], { opacity: 0, y: -30, duration: .35, ease: 'power2.in' })
      .addLabel('three').set(scenes[2], { opacity: 1 }).add(c.play(), 'three')
      .to({}, { duration: .7 });
    cuts = [master.labels.two / master.duration(), master.labels.three / master.duration()];
    setStep(0);
    /* clicking a step scrolls the pin to that scene */
    steps.forEach((st, i) => st.addEventListener('click', () => {
      const t = master.scrollTrigger; const p = [0.02, cuts[0] + .03, cuts[1] + .03][i];
      scrollTo(t.start + (t.end - t.start) * p, { duration: 1 });
    }));
    return () => { master.scrollTrigger && master.scrollTrigger.kill(); master.kill(); enterTrig.kill(); entrance.kill(); [a, b, c].forEach((t) => t.kill()); gsap.set([scenes, progress], { clearProps: 'all' }); };
  });

  /* Mobile & tablet: scenes stack; each plays once as it enters */
  mm.add('(max-width: 1023px)', () => {
    const a = sceneId(), b = sceneRegistry(), c = sceneStamp();
    const tls = [a, b, c]; const triggers = [];
    setStep(-1);
    tls.forEach((t, i) => {
      if (reduced) { t.progress(1); return; }
      triggers.push(ScrollTrigger.create({ trigger: scenes[i], start: 'top 80%', once: true, onEnter: () => t.play() }));
    });
    return () => { triggers.forEach((t) => t.kill()); tls.forEach((t) => t.kill()); gsap.set(scenes, { clearProps: 'all' }); };
  });
}

/* ── Globe: real people, real places ─────────────────────────── */
async function globe() {
  const wrap = document.querySelector('[data-globe]');
  const canvas = wrap.querySelector('[data-globe-canvas]');
  const pinsEl = wrap.querySelector('[data-globe-pins]');
  const THREE = await import('../three-lite.js');

  const PIN_IDS = ['kai-nakamura', 'leilani-akana', 'noa-kahale', 'amara-cole', 'daniel-reyes', 'grace-okafor', 'marcus-hale', 'priya-raman', 'mia-chen', 'sofia-marin'];
  const members = PIN_IDS.map((id) => byId[id]);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
  camera.position.set(0, 0, 4.1);
  const group = new THREE.Group();
  group.rotation.x = .28;
  scene.add(group);

  const toVec = (lat, lng, r = 1) => {
    const phi = (90 - lat) * Math.PI / 180, theta = (lng + 180) * Math.PI / 180;
    return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
  };

  /* occluder sphere */
  group.add(new THREE.Mesh(new THREE.SphereGeometry(.985, 64, 64), new THREE.MeshBasicMaterial({ color: 0x102857 })));

  /* dotted surface */
  const N = isTouch ? 1500 : 3000;
  const pos = new Float32Array(N * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = golden * i;
    pos[i * 3] = Math.cos(th) * rr; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(th) * rr;
  }
  const dotsGeo = new THREE.BufferGeometry(); dotsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dots = new THREE.Points(dotsGeo, new THREE.PointsMaterial({ color: 0x2981FB, size: .016, sizeAttenuation: true, transparent: true, opacity: .55 }));
  group.add(dots);

  /* graticule */
  const lineMat = new THREE.LineBasicMaterial({ color: 0xF4F7FB, transparent: true, opacity: .08 });
  for (let lat = -60; lat <= 60; lat += 30) {
    const pts = []; for (let lng = -180; lng <= 180; lng += 4) pts.push(toVec(lat, lng, 1.001));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }
  for (let lng = -180; lng < 180; lng += 30) {
    const pts = []; for (let lat = -90; lat <= 90; lat += 4) pts.push(toVec(lat, lng, 1.001));
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
  }

  /* arcs from Hilo (HQ) to every pinned member */
  const hq = members[0];
  const arcMat = new THREE.LineBasicMaterial({ color: 0x2981FB, transparent: true, opacity: .55 });
  const arcs = [];
  members.slice(1).forEach((m) => {
    const p1 = toVec(hq.lat, hq.lng, 1.01), p2 = toVec(m.lat, m.lng, 1.01);
    const mid = p1.clone().add(p2).multiplyScalar(.5).normalize().multiplyScalar(1 + p1.distanceTo(p2) * .35);
    const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(80));
    geo.setDrawRange(0, 0);
    const line = new THREE.Line(geo, arcMat); group.add(line); arcs.push(geo);
  });
  /* city dots */
  const cityGeo = new THREE.SphereGeometry(.014, 12, 12), cityMat = new THREE.MeshBasicMaterial({ color: 0xF4F7FB });
  members.forEach((m) => { const s = new THREE.Mesh(cityGeo, cityMat); s.position.copy(toVec(m.lat, m.lng, 1.005)); group.add(s); });

  /* HTML pins */
  pinsEl.innerHTML = members.map((m, i) => `<div class="pin ${i === 0 ? 'pin--hq' : ''}" data-pin="${i}"><img src="${photo(m.photo, 72)}" alt=""><span class="seal seal--sm is-static" data-quiet></span><span class="pin__txt">${m.first}<em>${m.city}</em></span></div>`).join('');
  await hydrateSeals(pinsEl);
  const pinEls = [...pinsEl.querySelectorAll('[data-pin]')];
  const pinVecs = members.map((m) => toVec(m.lat, m.lng, 1.02));

  /* face Hawaiʻi + the US mainland */
  const hqv = toVec(hq.lat, hq.lng);
  group.rotation.y = -Math.atan2(hqv.x, hqv.z) - .55;
  let velocity = 0, dragging = false, lastX = 0, autoSpin = reduced ? 0 : .0016;

  function resize() {
    const w = wrap.clientWidth, h = wrap.clientHeight || w;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize(); new ResizeObserver(resize).observe(wrap);

  const v = new THREE.Vector3(), camDir = new THREE.Vector3();
  function render() {
    if (!dragging) { group.rotation.y += autoSpin + velocity; velocity *= .94; }
    renderer.render(scene, camera);
    const w = wrap.clientWidth, h = wrap.clientHeight;
    group.updateMatrixWorld();
    camDir.copy(camera.position).normalize();
    const placed = [];
    const order = pinVecs.map((pv, i) => { v.copy(pv).applyMatrix4(group.matrixWorld); const facing = v.clone().normalize().dot(camDir); v.project(camera); return { i, facing, x: (v.x * .5 + .5) * w, y: (-v.y * .5 + .5) * h }; })
      .sort((p, q) => (q.i === 0) - (p.i === 0) || q.facing - p.facing);
    order.forEach(({ i, facing, x, y }) => {
      const el = pinEls[i];
      const vis = facing > .12;
      const offs = [[0, -26], [34, 18], [0, 26], [-34, 18]][i % 4];
      const px = x + offs[0], py = y + offs[1];
      const full = { l: px - 60, r: px + 60, t: py - 18, b: py + 18 };
      const crowded = vis && placed.some((r) => !(full.r < r.l || full.l > r.r || full.b < r.t || full.t > r.b));
      el.classList.toggle('is-crowded', crowded);
      if (vis) placed.push(crowded ? { l: px - 18, r: px + 18, t: py - 18, b: py + 18 } : full);
      el.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, -50%) scale(${vis ? (.85 + facing * .25).toFixed(3) : .6})`;
      el.style.opacity = vis ? Math.min(1, (facing - .12) * 4).toFixed(2) : 0;
      el.style.zIndex = Math.round(facing * 100) + (i === 0 ? 50 : 0);
    });
  }

  /* grow arcs when the section arrives */
  const grow = { t: 0 };
  ScrollTrigger.create({ trigger: wrap, start: 'top 75%', once: true, onEnter: () => gsap.to(grow, { t: 1, duration: 2.2, ease: 'power3.out', onUpdate: () => arcs.forEach((g) => g.setDrawRange(0, Math.floor(81 * grow.t))) }) });
  if (reduced) arcs.forEach((g) => g.setDrawRange(0, 81));

  /* drag to rotate */
  const onDown = (e) => { dragging = true; lastX = e.clientX; wrap.style.cursor = 'grabbing'; };
  const onMove = (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; group.rotation.y += dx * .005; velocity = dx * .0004; };
  const onUp = () => { dragging = false; wrap.style.cursor = 'grab'; };
  wrap.style.cursor = 'grab';
  wrap.addEventListener('pointerdown', onDown); window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);

  /* render only while visible */
  let raf = null;
  const loop = () => { render(); raf = requestAnimationFrame(loop); };
  ScrollTrigger.create({ trigger: wrap, start: 'top bottom', end: 'bottom top', onToggle: (self) => { if (self.isActive && !raf) loop(); else if (!self.isActive && raf) { cancelAnimationFrame(raf); raf = null; } } });
  render();
}

/* ── Score gauge ─────────────────────────────────────────────── */
function score() {
  runGauge(document.querySelector('[data-gauge-root]'), byId['kai-nakamura'].factors, { trigger: '[data-gauge]' });
}

/* ── Smaller choreographies ──────────────────────────────────── */
function extras() {
  /* masked word: slow vertical drift of the photo behind the letters */
  const masked = document.querySelector('[data-masked]');
  if (!reduced) gsap.fromTo(masked, { '--bg-y': '20%' }, { '--bg-y': '80%', ease: 'none', scrollTrigger: { trigger: masked, start: 'top bottom', end: 'bottom top', scrub: .8 } });
  if (!reduced) gsap.from(masked, { yPercent: 18, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: masked, start: 'top 88%', once: true } });

  /* quotes deal out like index cards */
  const quotes = document.querySelectorAll('.quote');
  if (!reduced) { suspend(quotes); gsap.from(quotes, { xPercent: (i) => (1 - i) * 90, y: 40, rotate: 0, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: '[data-quotes]', start: 'top 80%', once: true }, onComplete: () => gsap.set(quotes, { clearProps: 'transform,transition' }) }); }

  /* CTA seal slow scroll-rotation + 12-month ring */
  const ctaSeal = document.querySelector('[data-cta-seal]');
  if (!reduced) gsap.fromTo(ctaSeal, { rotate: -30 }, { rotate: 30, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: 1 } });
  const ring = document.querySelector('[data-ring12]');
  if (ring) gsap.fromTo(ring, { strokeDashoffset: 100 }, { strokeDashoffset: 8, duration: 2, ease: 'expo.out', scrollTrigger: { trigger: ring, start: 'top 90%', once: true } });

  /* giant wordmark settles behind the hero */
  const wm = document.querySelector('[data-hero-wordmark]');
  if (wm) gsap.to(wm, { opacity: .5, y: 0, duration: 2.2, ease: 'expo.out', delay: .2, startAt: { y: 40 } });
  if (wm && !reduced) gsap.to(wm, { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 } });

  /* pill boards pop in like stickers */
  document.querySelectorAll('[data-pills], [data-feat-pills]').forEach((board) => popIn(board.querySelectorAll('.pill'), {}, board));
  const sq = document.querySelector('.feats__squiggle path');
  if (sq) gsap.to(sq, { strokeDashoffset: 0, duration: 1.2, ease: 'power2.inOut', delay: .4, scrollTrigger: { trigger: '.feats__title', start: 'top 85%', once: true } });
  document.querySelectorAll('[data-feat-pills] .pill').forEach((p) => {
    const card = document.querySelector(`.bento__card--${p.dataset.target}`);
    if (!card) return;
    p.addEventListener('pointerenter', () => card.classList.add('is-hot'));
    p.addEventListener('pointerleave', () => card.classList.remove('is-hot'));
  });

  /* mascot stamp gently taps */
  const ms = document.querySelector('.mascot__stamp');
  if (ms && !reduced) gsap.to(ms, { rotate: -8, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '0px 40px' });
}

boot(
  async () => { build(); score(); },
  () => { hero(); how(); extras(); globe(); }
);
