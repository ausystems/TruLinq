import '../../styles/main.css';
import '../../styles/pages/pricing.css';
import { boot, gsap, reduced, isTouch, whenVisible, stamp } from '../main.js';
import { BILLING } from '../../data/billing.js';
import { createStamp } from '../stamp3d.js';

/* ── Billing period: every figure comes from the billing configuration ── */
const PERIODS = {
  yearly: { price: BILLING.yearlyPerMonth, line: 'per month, billed yearly', sub: `${BILLING.yearlyPerYear} a year · about ${BILLING.yearlyPerDay} a day` },
  monthly: { price: BILLING.monthlyPerMonth, line: 'per month, billed monthly', sub: `${BILLING.monthlyPerYear} over a year · cancel any month` }
};
function billing() {
  const price = document.querySelector('[data-price]'), line = document.querySelector('[data-per-line]'), sub = document.querySelector('[data-per-sub]');
  const saves = document.querySelector('[data-saves]');
  const btns = document.querySelectorAll('[data-period]');
  const apply = (period) => {
    const p = PERIODS[period];
    btns.forEach((b) => { const on = b.dataset.period === period; b.classList.toggle('is-active', on); b.setAttribute('aria-pressed', String(on)); });
    const slipPrice = document.querySelector('[data-slip-price]'), slipPer = document.querySelector('[data-slip-per]');
    const write = () => {
      price.textContent = p.price; line.textContent = p.line; sub.textContent = p.sub; price.classList.remove('is-changing');
      if (slipPrice) { slipPrice.textContent = p.price; slipPer.textContent = p.line; }
    };
    if (reduced) write(); else { price.classList.add('is-changing'); setTimeout(write, 140); }
    saves.classList.toggle('is-muted', period !== 'yearly');
  };
  btns.forEach((b) => b.addEventListener('click', () => apply(b.dataset.period)));
}

/* ── The rubber stamp and the plan it stamps ────────────────────
   The plan lies on the desk as a slip of paper, placed so its seal sits exactly under the stamp's landing spot. The
   stamp presses once as the page arrives (or as the stage comes into view, on a phone) and again when clicked or
   tapped. Without WebGL the slip lies there already stamped. */
async function rubberStamp() {
  const stage = document.querySelector('[data-stamp-stage]');
  const desk = stage.querySelector('.phero-p__desk'), canvas = stage.querySelector('[data-stamp-canvas]');
  const slip = stage.querySelector('[data-slip]'), sealEl = slip.querySelector('[data-slip-seal]');
  const narrow = matchMedia('(max-width: 1023px)');
  gsap.set(slip, { rotationX: 34, rotationZ: -6, rotationY: 4, transformPerspective: 1400, transformOrigin: '50% 50%' });

  let S;
  try {
    S = await createStamp(canvas, desk, {
      mode: 'straight', fov: 30, camPos: [0, 3.6, 9.4], look: [0, .7, 0], scale: .62,
      rest: { x: -.32, y: -.7, z: .08 }, restY: .95, dropY: 1, shadowY: -.02, softShadow: true, shadowOpacity: .1, pressShadow: .26, position: [.35, 0, .4]
    });
  } catch (e) {
    console.info('[trulinq] 3D stamp unavailable', e);
    canvas.remove();
    gsap.set(slip, { clearProps: 'transform' });
    Object.assign(slip.style, { left: '50%', top: '50%', transform: 'translate(-50%, -50%) rotate(-3deg)' });
    sealEl.classList.add('is-stamped');
    slip.classList.add('is-placed');
    return;
  }

  /* where the stamp lands (world units), and the slip moved so its seal sits right under it, kept inside the desk */
  const BASE_X = .35, LAND = [BASE_X, -.06, .4];
  const place = () => {
    const land = S.project(...LAND), hr = desk.getBoundingClientRect(), sr = sealEl.getBoundingClientRect(), wr = slip.getBoundingClientRect();
    slip.style.left = `${(wr.left - hr.left) + (land.x - (sr.left + sr.width / 2 - hr.left))}px`;
    slip.style.top = `${(wr.top - hr.top) + (land.y - (sr.top + sr.height / 2 - hr.top))}px`;
  };
  const shift = (du) => { LAND[0] = BASE_X + du; S.group.position.x = BASE_X + du; S.shadow.position.x = BASE_X + du; };
  const frame = () => {
    S.resize();
    S.camera.lookAt(0, narrow.matches ? .55 : .7, 0);
    S.camera.updateMatrixWorld();
    shift(0); place();
    const hr = desk.getBoundingClientRect(), cr = slip.getBoundingClientRect(), pad = 8;
    const dx = cr.left < hr.left + pad ? (hr.left + pad) - cr.left : cr.right > hr.right - pad ? (hr.right - pad) - cr.right : 0;
    if (dx) { const a = S.project(...LAND), b = S.project(LAND[0] + 1, LAND[1], LAND[2]); shift(dx / (b.x - a.x)); place(); }
    S.render();
    slip.classList.add('is-placed');
  };
  frame();
  new ResizeObserver(frame).observe(desk);
  gsap.fromTo(slip, { opacity: 0 }, { opacity: 1, duration: .5, ease: 'power2.out' });

  if (reduced) { sealEl.classList.add('is-stamped'); return; }

  /* the impact: the seal is printed, the slip takes the weight */
  const thud = () => {
    if (!sealEl.classList.contains('is-stamped')) stamp(sealEl, { rotate: -8 });
    else gsap.fromTo(sealEl, { scale: .88 }, { scale: 1, duration: .8, ease: 'elastic.out(1, .45)' });
    gsap.timeline().to(slip, { y: 7, duration: .1, ease: 'power2.out' }).to(slip, { y: 0, duration: .8, ease: 'elastic.out(1, .45)' });
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
  whenVisible(stage, () => press(.5), { rootMargin: '0px 0px -20% 0px' });
  stage.addEventListener(isTouch ? 'click' : 'pointerdown', (e) => { if (!e.button && !pressing && sealEl.classList.contains('is-stamped')) press(0); });
}

boot(async () => { billing(); }, () => { rubberStamp(); });
