/* The Trulinq rubber stamp in Three.js: a turned navy handle, a blue rubber base and the seal on its face. Shared by
   the pricing hero and the homepage hero. The caller drives `press.t` (0 = hovering, 1 = pressed onto the desk) and
   `setPointer()`; the module owns the scene, the idle motion and the render loop. */
import { isTouch, reduced } from './main.js';

function sealTexture(T) {
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
  const markT = new Path2D('M28 139H775L654 289H406V938H271V289H28Z');
  const markD = new Path2D('M473 362H600V487H668V362H763A288 288 0 0 1 763 938H473ZM600 487H763A163 163 0 0 1 763 813H600Z');
  ctx.save(); ctx.translate(size / 2, size / 2); const mk = (size * .36) / 1080; ctx.scale(mk, mk); ctx.translate(-540, -540);
  const tGrad = ctx.createLinearGradient(0, 139, 0, 938); tGrad.addColorStop(0, '#FCFCFC'); tGrad.addColorStop(1, '#C6C6C6'); ctx.fillStyle = tGrad; ctx.fill(markT);
  const dGrad = ctx.createLinearGradient(0, 362, 0, 938); dGrad.addColorStop(0, '#0080FF'); dGrad.addColorStop(1, '#003CAC'); ctx.fillStyle = dGrad; ctx.fill(markD, 'evenodd');
  ctx.restore();
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
  return tex;
}

export async function createStamp(canvas, host, o = {}) {
  const T = await import('./three-stamp.js');
  const opt = {
    fov: 28, camPos: [0, .9, 9.4], look: [0, .45, 0],
    rest: { x: -.55, y: -.5, z: .12 }, restY: .55, dropY: 1.7, bob: .08, spin: .12, idleTilt: .06,
    pointer: { x: .45, y: .22, z: .08 },
    /* 'tip' leans the stamp forward as it presses (pricing); 'straight' squares it up so the face lands flat (hero) */
    mode: 'tip', shadowY: -1.9, shadowOpacity: .14, position: [0, 0, 0], scale: 1,
    ...o
  };
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isTouch ? 1.5 : 2));
  renderer.outputColorSpace = T.SRGBColorSpace;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(opt.fov, 1, .1, 50);
  camera.position.set(...opt.camPos);
  camera.lookAt(...opt.look);

  scene.add(new T.HemisphereLight(0xFFFFFF, 0xDCEBFF, 1.4));
  const key = new T.DirectionalLight(0xFFFFFF, 2.2); key.position.set(3, 6, 4); scene.add(key);
  const rim = new T.DirectionalLight(0x4AB3FF, .9); rim.position.set(-4, 3, -3); scene.add(rim);

  const group = new T.Group();
  const wood = new T.MeshStandardMaterial({ color: 0x102857, roughness: .55, metalness: .05 });
  const navy = new T.MeshStandardMaterial({ color: 0x051B49, roughness: .5, metalness: .1 });
  const rubber = new T.MeshStandardMaterial({ color: 0x2981FB, roughness: .85 });
  const cream = new T.MeshStandardMaterial({ color: 0xF4F7FB, roughness: .6 });
  const pts = [];
  [[.0, 0], [.42, 0], [.46, .12], [.36, .3], [.3, .55], [.34, .8], [.5, 1.05], [.56, 1.35], [.5, 1.6], [.3, 1.78], [.0, 1.82]].forEach(([x, y]) => pts.push(new T.Vector2(x, y)));
  const handle = new T.Mesh(new T.LatheGeometry(pts, 48), wood); handle.position.y = .62; group.add(handle);
  const collar = new T.Mesh(new T.CylinderGeometry(.62, .7, .34, 48), navy); collar.position.y = .45; group.add(collar);
  const plate = new T.Mesh(new T.CylinderGeometry(1.15, 1.15, .18, 64), cream); plate.position.y = .19; group.add(plate);
  const base = new T.Mesh(new T.CylinderGeometry(1.12, 1.12, .2, 64), rubber); base.position.y = 0; group.add(base);
  const face = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, .02, 64), new T.MeshBasicMaterial({ map: sealTexture(T) })); face.position.y = -.1; face.rotation.set(Math.PI, 0, 0); group.add(face);
  const band = new T.Mesh(new T.TorusGeometry(1.14, .05, 16, 64), navy); band.rotation.x = Math.PI / 2; band.position.y = .1; group.add(band);
  group.position.set(opt.position[0], opt.restY, opt.position[2]);
  group.rotation.set(opt.rest.x, opt.rest.y, opt.rest.z);
  group.scale.setScalar(opt.scale);
  scene.add(group);

  const shadow = new T.Mesh(new T.CylinderGeometry(1.35, 1.35, .01, 64), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: opt.shadowOpacity }));
  shadow.position.set(opt.position[0], opt.shadowY, opt.position[2]); scene.add(shadow);

  function resize() { const w = host.clientWidth, h = host.clientHeight || w; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  resize(); new ResizeObserver(resize).observe(host);

  const pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 };
  const press = { t: 0 };
  let t0 = performance.now(), raf = null;
  const lerp = (a, b, k) => a + (b - a) * k;
  function render(now = performance.now()) {
    const t = (now - t0) / 1000;
    pointer.x += (target.x - pointer.x) * .06; pointer.y += (target.y - pointer.y) * .06;
    const idle = reduced ? 0 : Math.sin(t * 1.1) * opt.idleTilt;
    const spin = reduced ? 0 : t * opt.spin;
    const rx = opt.rest.x + pointer.y * opt.pointer.y + idle * .5, ry = opt.rest.y + pointer.x * opt.pointer.x + spin, rz = opt.rest.z + pointer.x * opt.pointer.z;
    if (opt.mode === 'tip') { group.rotation.set(rx + press.t * 1.2, ry, rz); }
    else { group.rotation.set(lerp(rx, 0, press.t), lerp(ry, Math.round(ry / (Math.PI * 2)) * Math.PI * 2 - .35, press.t), lerp(rz, 0, press.t)); }
    group.position.y = opt.restY + (reduced ? 0 : Math.sin(t * .9) * opt.bob) - press.t * opt.dropY;
    shadow.scale.setScalar(opt.scale * (1 - press.t * .25)); shadow.material.opacity = opt.shadowOpacity + press.t * .3;
    renderer.render(scene, camera);
  }
  const loop = (now) => { render(now); raf = requestAnimationFrame(loop); };
  const start = () => { if (!raf) raf = requestAnimationFrame(loop); };
  const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = null; } };
  render();

  /* screen position (host pixels) of a world point, for lining DOM up with the stamp's landing spot */
  const v = new T.Vector3();
  const project = (x = opt.position[0], y = 0, z = opt.position[2]) => { v.set(x, y, z).project(camera); return { x: (v.x * .5 + .5) * host.clientWidth, y: (-v.y * .5 + .5) * host.clientHeight }; };

  return { T, renderer, scene, camera, group, shadow, press, render, start, stop, resize, project, setPointer: (x, y) => { target.x = x; target.y = y; }, nudgeSpin: (dx) => { t0 -= dx; } };
}
