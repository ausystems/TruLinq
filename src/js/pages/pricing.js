import '../../styles/main.css';
import '../../styles/pages/pricing.css';
import { boot, gsap, ScrollTrigger, reduced, isTouch, stamp, suspend } from '../main.js';

/* ── Billing toggle ──────────────────────────────────────────── */
function billing() {
  const price = document.querySelector('[data-price]');
  const line = document.querySelector('[data-per-line]');
  const sub = document.querySelector('[data-per-sub]');
  const note = document.querySelector('.phero-p__note');
  const btns = document.querySelectorAll('[data-period]');
  const state = { v: 19 };
  const apply = (period) => {
    btns.forEach((b) => { const on = b.dataset.period === period; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    const target = period === 'yearly' ? 19 : 24;
    if (reduced) { price.textContent = target; }
    else gsap.to(state, { v: target, duration: .7, ease: 'expo.out', onUpdate: () => (price.textContent = Math.round(state.v)) });
    line.textContent = period === 'yearly' ? 'per month, billed yearly' : 'per month, billed monthly';
    sub.textContent = period === 'yearly' ? '$228 a year · about 63¢ a day' : '$288 a year · cancel any month';
    if (note) gsap.to(note, { opacity: period === 'yearly' ? 1 : .35, duration: .4 });
  };
  btns.forEach((b) => b.addEventListener('click', () => apply(b.dataset.period)));
}

/* ── The rubber stamp (Three.js) ─────────────────────────────── */
async function rubberStamp() {
  const stage = document.querySelector('[data-stamp-stage]');
  const canvas = stage.querySelector('[data-stamp-canvas]');
  const impression = stage.querySelector('[data-impression]');
  const T = await import('../three-stamp.js');

  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(28, 1, .1, 50);
  camera.position.set(0, .9, 9.4);
  camera.lookAt(0, .45, 0);

  scene.add(new T.HemisphereLight(0xFFFFFF, 0xDCEBFF, 1.4));
  const key = new T.DirectionalLight(0xFFFFFF, 2.2); key.position.set(3, 6, 4); scene.add(key);
  const rim = new T.DirectionalLight(0x4AB3FF, .9); rim.position.set(-4, 3, -3); scene.add(rim);

  /* seal texture for the base: the Trulinq seal (navy face, sky-to-royal rim, ring text, the mark) */
  const size = 1024, c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d');
  const faceGrad = ctx.createRadialGradient(size * .38, size * .3, 0, size * .38, size * .3, size * .85);
  faceGrad.addColorStop(0, '#1A2E4C'); faceGrad.addColorStop(.55, '#06132A'); faceGrad.addColorStop(1, '#020511');
  ctx.fillStyle = faceGrad; ctx.beginPath(); ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); ctx.fill();
  const rimGrad = ctx.createLinearGradient(size * .2, 0, size * .8, size);
  rimGrad.addColorStop(0, '#77D9FF'); rimGrad.addColorStop(.5, '#007DF3'); rimGrad.addColorStop(1, '#4FC1FF');
  ctx.strokeStyle = rimGrad; ctx.lineWidth = 28; ctx.beginPath(); ctx.arc(size / 2, size / 2, size * .46, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(54,172,255,.45)'; ctx.lineWidth = 12; ctx.beginPath(); ctx.arc(size / 2, size / 2, size * .285, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#36ACFF'; ctx.font = '700 92px Geist, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const text = 'TRULINQ · VERIFIED · ENTREPRENEUR · '; const radius = size * .37;
  ctx.save(); ctx.translate(size / 2, size / 2);
  const per = (Math.PI * 2) / text.length;
  for (let i = 0; i < text.length; i++) { ctx.save(); ctx.rotate(i * per - Math.PI / 2); ctx.translate(0, -radius); ctx.fillText(text[i], 0, 0); ctx.restore(); }
  ctx.restore();
  /* the mark (the ring text is drawn unmirrored on this face, so the mark is too) */
  const markT = new Path2D('M28 139H775L654 289H406V938H271V289H28Z');
  const markD = new Path2D('M473 362H600V487H668V362H763A288 288 0 0 1 763 938H473ZM600 487H763A163 163 0 0 1 763 813H600Z');
  ctx.save(); ctx.translate(size / 2, size / 2); const mk = (size * .36) / 1080; ctx.scale(mk, mk); ctx.translate(-540, -540);
  const tGrad = ctx.createLinearGradient(0, 139, 0, 938); tGrad.addColorStop(0, '#FCFCFC'); tGrad.addColorStop(1, '#C6C6C6'); ctx.fillStyle = tGrad; ctx.fill(markT);
  const dGrad = ctx.createLinearGradient(0, 362, 0, 938); dGrad.addColorStop(0, '#0080FF'); dGrad.addColorStop(1, '#003CAC'); ctx.fillStyle = dGrad; ctx.fill(markD, 'evenodd');
  ctx.restore();
  const sealTex = new T.CanvasTexture(c); sealTex.colorSpace = T.SRGBColorSpace; sealTex.anisotropy = 8;

  const stampGroup = new T.Group();
  const wood = new T.MeshStandardMaterial({ color: 0x102857, roughness: .55, metalness: .05 });
  const navy = new T.MeshStandardMaterial({ color: 0x051B49, roughness: .5, metalness: .1 });
  const rubber = new T.MeshStandardMaterial({ color: 0x2981FB, roughness: .85 });
  const cream = new T.MeshStandardMaterial({ color: 0xF4F7FB, roughness: .6 });

  /* handle: lathe profile for a turned wooden knob */
  const pts = [];
  const prof = [[.0, 0], [.42, 0], [.46, .12], [.36, .3], [.3, .55], [.34, .8], [.5, 1.05], [.56, 1.35], [.5, 1.6], [.3, 1.78], [.0, 1.82]];
  prof.forEach(([x, y]) => pts.push(new T.Vector2(x, y)));
  const handle = new T.Mesh(new T.LatheGeometry(pts, 48), wood); handle.position.y = .62; stampGroup.add(handle);
  const collar = new T.Mesh(new T.CylinderGeometry(.62, .7, .34, 48), navy); collar.position.y = .45; stampGroup.add(collar);
  const plate = new T.Mesh(new T.CylinderGeometry(1.15, 1.15, .18, 64), cream); plate.position.y = .19; stampGroup.add(plate);
  const base = new T.Mesh(new T.CylinderGeometry(1.12, 1.12, .2, 64), rubber); base.position.y = 0; stampGroup.add(base);
  const face = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, .02, 64), new T.MeshBasicMaterial({ map: sealTex })); face.position.y = -.1; face.rotation.set(Math.PI, 0, 0); stampGroup.add(face);
  const band = new T.Mesh(new T.TorusGeometry(1.14, .05, 16, 64), navy); band.rotation.x = Math.PI / 2; band.position.y = .1; stampGroup.add(band);
  stampGroup.position.y = .1;
  stampGroup.rotation.set(-.55, -.35, .18);
  scene.add(stampGroup);

  /* shadow disc */
  const shadow = new T.Mesh(new T.CylinderGeometry(1.35, 1.35, .01, 64), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: .14 }));
  shadow.position.y = -1.9; scene.add(shadow);

  function resize() { const w = stage.clientWidth, h = stage.clientHeight || w; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); new ResizeObserver(resize).observe(stage);

  const pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  if (!isTouch) window.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); target.x = ((e.clientX - r.left) / r.width - .5) * 2; target.y = ((e.clientY - r.top) / r.height - .5) * 2; });

  const press = { t: 0 }; let t0 = performance.now(), raf = null;
  function render(now) {
    const t = (now - t0) / 1000;
    pointer.x += (target.x - pointer.x) * .06; pointer.y += (target.y - pointer.y) * .06;
    const idle = reduced ? 0 : Math.sin(t * 1.1) * .06;
    stampGroup.rotation.x = -.55 + pointer.y * .22 + idle * .5 + press.t * 1.2;
    stampGroup.rotation.y = -.5 + pointer.x * .45 + (reduced ? 0 : t * .12);
    stampGroup.rotation.z = .12 + pointer.x * .08;
    stampGroup.position.y = .55 + (reduced ? 0 : Math.sin(t * .9) * .08) - press.t * 1.7;
    shadow.scale.setScalar(1 - press.t * .25); shadow.material.opacity = .14 + press.t * .3;
    renderer.render(scene, camera);
  }
  const loop = (now) => { render(now); raf = requestAnimationFrame(loop); };
  if (reduced) { render(performance.now()); }
  else ScrollTrigger.create({ trigger: stage, start: 'top bottom', end: 'bottom top', onToggle: (s) => { if (s.isActive && !raf) raf = requestAnimationFrame(loop); else if (!s.isActive && raf) { cancelAnimationFrame(raf); raf = null; } } });
  render(performance.now());

  /* the press: scroll from the hero into the plans pushes the stamp down and leaves an impression */
  if (!reduced) {
    gsap.timeline({ scrollTrigger: { trigger: '.plans', start: 'top 95%', end: 'top 35%', scrub: .8 } })
      .to(press, { t: 1, ease: 'power3.in' }, 0)
      .to(impression, { opacity: .9, scale: 1, ease: 'expo.out', duration: .3 }, .7)
      .to(press, { t: 0, ease: 'elastic.out(1, .5)' }, 1);
  }

  /* drag to spin */
  let dragging = false, lastX = 0;
  stage.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.style.cursor = 'grabbing'; });
  window.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; t0 -= dx * 40; });
  window.addEventListener('pointerup', () => { dragging = false; canvas.style.cursor = 'grab'; });
}

/* ── Register checks & ledger leaders ────────────────────────── */
function registerChecks() {
  const rows = document.querySelectorAll('.register__row');
  rows.forEach((row, i) => {
    ScrollTrigger.create({ trigger: row, start: 'top 92%', once: true, onEnter: () => row.querySelectorAll('[data-yes]').forEach((c, j) => setTimeout(() => c.classList.add('is-in'), j * 90)) });
  });
  const leaders = document.querySelectorAll('[data-ledger-draw] .ledger__row > i');
  if (reduced) return;
  gsap.from(leaders, { scaleX: 0, duration: 1.2, ease: 'expo.out', stagger: .1, scrollTrigger: { trigger: '[data-ledger-draw]', start: 'top 85%', once: true } });
  gsap.from('[data-ledger-draw] .ledger__row > b', { opacity: 0, x: 10, duration: .8, ease: 'expo.out', stagger: .1, delay: .4, scrollTrigger: { trigger: '[data-ledger-draw]', start: 'top 85%', once: true } });
}

function plansRise() {
  const plans = document.querySelectorAll('.plan');
  if (reduced) return;
  suspend(plans);
  gsap.from(plans, { y: 70, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: .12, scrollTrigger: { trigger: '.plans', start: 'top 85%', once: true }, onComplete: () => gsap.set(plans, { clearProps: 'transform,transition' }) });
}

boot(async () => { billing(); }, () => { plansRise(); registerChecks(); rubberStamp(); });
