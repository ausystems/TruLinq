import '../../styles/main.css';
import '../../styles/pages/home.css';
import { boot, gsap, ScrollTrigger, stamp, reduced, isTouch, hydrateSeals, popIn, suspend, scrollTo } from '../main.js';
import { idCard, photo } from '../ui.js';
import { byId, SCENES } from '../../data/members.js';
import { gaugeHTML, factorsHTML, runGauge } from '../gauge.js';
import { mascotSVG, mascotParts, prime, review, idle, liveIdle } from '../mascot.js';
import { createStamp } from '../stamp3d.js';

/* ── Build DOM that depends on data ──────────────────────────── */
function build() {
  const kai = byId['kai-nakamura'], leilani = byId['leilani-akana'], grace = byId['grace-okafor'];

  const heroCard = document.querySelector('[data-hero-card]');
  heroCard.innerHTML = idCard(kai, { href: false, stamp: true });
  heroCard.querySelector('.seal').setAttribute('data-manual', '');
  heroCard.querySelectorAll('img').forEach((img) => { img.loading = 'eager'; img.fetchPriority = 'high'; });

  /* one mascot, three appearances: the hero desk, the stamped scene, the FAQ */
  document.querySelector('[data-hero-mascot]').innerHTML = mascotSVG({ marks: false });
  document.querySelector('[data-how-mascot]').innerHTML = mascotSVG({ marks: false });
  document.querySelector('[data-faq-mascot]').innerHTML = `<div class="mascot-root" data-faq-root>${mascotSVG({ marks: true })}</div>`;

  const howCard = document.querySelector('[data-how-card]');
  howCard.innerHTML = idCard(kai, { href: false, stamp: true });
  howCard.querySelector('.seal').setAttribute('data-manual', '');

  document.querySelector('[data-world-cards]').innerHTML = idCard(leilani) + idCard(grace);

  const masked = document.querySelector('[data-masked]');
  masked.style.setProperty('--mask-img', `url(${photo(SCENES.team, 1600, 1000)})`);

  document.querySelector('[data-gauge-mount]').innerHTML = gaugeHTML({ caption: 'Kai Nakamura · Pacific Reef Ventures' });
  document.querySelector('[data-factors-mount]').innerHTML = factorsHTML(kai);
}

/* ── Hero: the stamp presses the seal onto the card while the reviewer watches ── */
async function hero() {
  const heroEl = document.querySelector('[data-hero]');
  const stage = heroEl.querySelector('[data-hero-stage]');
  const cardWrap = heroEl.querySelector('[data-hero-card]');
  const card = cardWrap.querySelector('.idcard');
  const seal = card.querySelector('.seal');
  const canvas = heroEl.querySelector('[data-hero-stamp]');
  const p = mascotParts(heroEl.querySelector('[data-hero-mascot]'));

  /* the card lies on the desk */
  gsap.set(card, { rotateX: 34, rotateZ: -6, rotateY: 4, transformPerspective: 1400, transformOrigin: '50% 50%' });
  const S = await createStamp(canvas, stage, {
    mode: 'straight', fov: 30, camPos: [0, 3.6, 9.4], look: [0, .8, 0], scale: .56,
    rest: { x: -.32, y: -.7, z: .08 }, restY: .95, dropY: 1, bob: .07, spin: .1, idleTilt: .05,
    shadowY: -.02, shadowOpacity: .1, position: [-.1, 0, .4]
  });
  const LAND = [-.1, -.06, .4];

  /* put the card's seal exactly under the stamp's landing spot (host pixels) */
  const place = () => {
    const land = S.project(...LAND);
    const st = stage.getBoundingClientRect(), sr = seal.getBoundingClientRect(), wr = cardWrap.getBoundingClientRect();
    const fy = gsap.getProperty(cardWrap, 'y') || 0;
    const cx = sr.left + sr.width / 2 - st.left, cy = sr.top + sr.height / 2 - st.top - fy;
    cardWrap.style.left = `${(wr.left - st.left) + (land.x - cx)}px`;
    cardWrap.style.top = `${(wr.top - st.top - fy) + (land.y - cy)}px`;
  };
  place(); window.addEventListener('resize', place);

  /* the impact: the seal slams on, the card takes the hit */
  const thud = () => {
    if (!seal.classList.contains('is-stamped')) stamp(seal, { rotate: -7 });
    else gsap.fromTo(seal, { scale: .86 }, { scale: 1, duration: .9, ease: 'elastic.out(1, .4)' });
    gsap.timeline().to(card, { y: 9, duration: .1, ease: 'power2.out' }).to(card, { y: 0, duration: .9, ease: 'elastic.out(1, .4)' });
  };

  if (reduced) {
    gsap.set('.hero__line > span', { y: 0 }); gsap.set('.hero__eyebrow, .hero__lead, .hero__cta', { opacity: 1 });
    gsap.set(cardWrap, { opacity: 1 }); seal.classList.add('is-stamped');
    S.render();
    return;
  }

  gsap.set(['.hero__lead', '.hero__cta'], { y: 24 });
  gsap.set(cardWrap, { opacity: 0, y: 60 });
  gsap.set(canvas, { opacity: 0, y: -80 });
  prime(p);
  S.start();
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('.hero__eyebrow', { opacity: 1, duration: .9 }, 0)
    .to('.hero__line > span', { y: 0, duration: 1.4, stagger: .13 }, .05)
    .to('.hero__lead', { opacity: 1, y: 0, duration: 1.1 }, .75)
    .to('.hero__cta', { opacity: 1, y: 0, duration: 1.1 }, .9)
    /* the card slides onto the desk, the stamp arrives from above */
    .to(cardWrap, { opacity: 1, y: 0, duration: 1.4 }, .5)
    .to(canvas, { opacity: 1, y: 0, duration: 1.3 }, .7)
    /* the press: down fast, thud, lift with a spring */
    .to(S.press, { t: 1, duration: .38, ease: 'power3.in' }, 1.6)
    .add(thud, 1.98)
    .to(S.press, { t: 0, duration: 1.1, ease: 'elastic.out(1, .45)' }, 2.12)
    /* then the card breathes on the desk */
    .add(() => gsap.to(cardWrap, { y: -6, duration: 3.8, ease: 'sine.inOut', yoyo: true, repeat: -1 }), 3.2);
  /* the reviewer thumps its own stamp in the same beat */
  review(tl, p, { land: 1.98 });

  /* pointer parallax: the desk tilts a little, the stamp leans with you */
  if (!isTouch) {
    const rx = gsap.quickTo(card, 'rotationX', { duration: 1.2, ease: 'power3.out' }), ry = gsap.quickTo(card, 'rotationY', { duration: 1.2, ease: 'power3.out' });
    heroEl.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width, dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      S.setPointer(dx * 2, dy * 2);
      if (tl.isActive()) return;
      rx(34 + dy * -5); ry(4 + dx * 7);
    });
    heroEl.addEventListener('pointerleave', () => { S.setPointer(0, 0); rx(34); ry(4); });
  }

  /* click the desk: the stamp presses again */
  let pressing = false;
  stage.addEventListener('pointerdown', (e) => {
    if (e.button || pressing || tl.isActive() || e.target.closest('[data-hero-mascot]')) return;
    pressing = true;
    gsap.timeline({ onComplete: () => (pressing = false) })
      .to(S.press, { t: 1, duration: .3, ease: 'power3.in' })
      .add(thud, .3)
      .add(() => { gsap.timeline().to(p.eyes, { scaleY: 1.18, scaleX: 1.08, duration: .1 }).to(p.eyes, { scaleY: 1, scaleX: 1, duration: .5, ease: 'elastic.out(1, .5)' }); gsap.timeline().to(p.body, { scaleY: .94, scaleX: 1.04, duration: .09 }).to(p.body, { scaleY: 1, scaleX: 1, duration: .7, ease: 'elastic.out(1, .4)' }); }, .3)
      .to(S.press, { t: 0, duration: 1, ease: 'elastic.out(1, .45)' }, .42);
  });
  stage.style.cursor = 'pointer';

  /* render only while the hero is on screen */
  ScrollTrigger.create({ trigger: stage, start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? S.start() : S.stop()) });
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
/* The stamped scene plays in real time (never scrubbed): the card rises, the seal slams, the reviewer pops up and
   thumps in the same beat, then lives on the stage until the scene leaves. */
function sceneStamp() {
  const s = document.querySelector('[data-scene="2"]');
  const card = s.querySelector('.idcard');
  const seal = s.querySelector('.seal');
  const p = mascotParts(s.querySelector('[data-how-mascot]'));
  const tl = gsap.timeline({ paused: true });
  gsap.set(card, { xPercent: 6, yPercent: -10 });
  tl.fromTo(card, { y: 60, rotate: -8, opacity: 0 }, { y: 0, rotate: -3, opacity: 1, duration: 1, ease: 'expo.out' })
    .fromTo(seal, { opacity: 0, scale: 2.2, rotate: -26 }, { opacity: 1, scale: 1, rotate: -8, duration: .55, ease: 'power4.in' }, .9)
    .to(card, { rotate: -1.5, y: 6, duration: .18, ease: 'power2.out' }, 1.42)
    .to(card, { y: 0, duration: .8, ease: 'elastic.out(1, .4)' }, 1.6)
    .to(seal, { scale: 1.04, duration: .8, ease: 'elastic.out(1, .4)' }, 1.45);
  if (p) {
    prime(p);
    review(tl, p, { land: 1.45, idle: false });
    tl.eventCallback('onComplete', () => { tl.life = liveIdle(p); });
  }
  /* leaving the scene: stop the idle loops and put everything back to the start, ready to replay */
  tl.reset = () => { if (tl.life) { tl.life.kill(); tl.life = null; } tl.pause(0); };
  return tl;
}

function how() {
  const section = document.querySelector('[data-how]');
  const steps = section.querySelectorAll('[data-step]');
  const scenes = section.querySelectorAll('[data-scene]');
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
    let cuts = [0, 1], inThree = false;
    /* the first two scenes are scrubbed; the stamped scene plays itself the moment the stage reaches it */
    const enterThree = () => { if (inThree) return; inThree = true; c.play(0); };
    const leaveThree = () => { if (!inThree) return; inThree = false; c.reset(); };
    const master = gsap.timeline({
      scrollTrigger: { trigger: section, start: 'top top', end: '+=260%', pin: true, pinSpacing: true, scrub: .8, anticipatePin: 1, invalidateOnRefresh: true,
        onUpdate: (self) => { const step = self.progress < cuts[0] ? 0 : self.progress < cuts[1] ? 1 : 2; setStep(step); if (step === 2) enterThree(); else leaveThree(); } }
    });
    master.addLabel('one').add(a.play(), 'one')
      .to({}, { duration: .5 })
      .to(scenes[0], { opacity: 0, y: -30, duration: .35, ease: 'power2.in' })
      .addLabel('two').set(scenes[1], { opacity: 1 }).add(b.play(), 'two')
      .to({}, { duration: .5 })
      .to(scenes[1], { opacity: 0, y: -30, duration: .35, ease: 'power2.in' })
      .addLabel('three').set(scenes[2], { opacity: 1 })
      .to({}, { duration: 1.2 });
    cuts = [master.labels.two / master.duration(), master.labels.three / master.duration()];
    setStep(0);
    /* clicking a step scrolls the pin to that scene */
    steps.forEach((st, i) => st.addEventListener('click', () => {
      const t = master.scrollTrigger; const p = [0.02, cuts[0] + .03, cuts[1] + .03][i];
      scrollTo(t.start + (t.end - t.start) * p, { duration: 1 });
    }));
    return () => { leaveThree(); master.scrollTrigger && master.scrollTrigger.kill(); master.kill(); enterTrig.kill(); entrance.kill(); [a, b, c].forEach((t) => t.kill()); gsap.set(scenes, { clearProps: 'all' }); };
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
    return () => { c.reset(); triggers.forEach((t) => t.kill()); tls.forEach((t) => t.kill()); gsap.set(scenes, { clearProps: 'all' }); };
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
  group.add(new THREE.Mesh(new THREE.SphereGeometry(.985, 64, 64), new THREE.MeshBasicMaterial({ color: 0xFFFFFF })));

  /* dotted surface: the whole globe is made of dots, no lines */
  const N = isTouch ? 1500 : 3000;
  const pos = new Float32Array(N * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(1 - y * y), th = golden * i;
    pos[i * 3] = Math.cos(th) * rr; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(th) * rr;
  }
  const dotsGeo = new THREE.BufferGeometry(); dotsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dots = new THREE.Points(dotsGeo, new THREE.PointsMaterial({ color: 0x2981FB, size: .018, sizeAttenuation: true, transparent: true, opacity: .5 }));
  group.add(dots);

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
  const cityGeo = new THREE.SphereGeometry(.014, 12, 12), cityMat = new THREE.MeshBasicMaterial({ color: 0x0C1526 });
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
  document.querySelectorAll('[data-feat-pills] .pill').forEach((p) => {
    const card = document.querySelector(`.bento__card--${p.dataset.target}`);
    if (!card) return;
    p.addEventListener('pointerenter', () => card.classList.add('is-hot'));
    p.addEventListener('pointerleave', () => card.classList.remove('is-hot'));
  });

  /* the FAQ mascot lives: breathes, blinks, follows you, hops when tapped */
  const faq = mascotParts(document.querySelector('[data-faq-root]'));
  if (faq) idle(faq, { hop: true });
}

boot(
  async () => { build(); score(); },
  () => { hero(); how(); extras(); globe(); }
);
