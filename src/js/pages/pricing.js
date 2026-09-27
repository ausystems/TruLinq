import '../../styles/main.css';
import '../../styles/pages/pricing.css';
import { boot, gsap, reduced, isTouch, whenVisible } from '../main.js';
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
    const write = () => { price.textContent = p.price; line.textContent = p.line; sub.textContent = p.sub; price.classList.remove('is-changing'); };
    if (reduced) write(); else { price.classList.add('is-changing'); setTimeout(write, 140); }
    saves.classList.toggle('is-muted', period !== 'yearly');
  };
  btns.forEach((b) => b.addEventListener('click', () => apply(b.dataset.period)));
}

/* ── The rubber stamp: it presses once when it comes into view, and again when clicked ── */
async function rubberStamp() {
  const stage = document.querySelector('[data-stamp-stage]');
  const canvas = stage.querySelector('[data-stamp-canvas]');
  const impression = stage.querySelector('[data-impression]');
  let S;
  try { S = await createStamp(canvas, stage, { mode: 'tip' }); }
  catch (e) { console.info('[trulinq] 3D stamp unavailable', e); canvas.remove(); impression.classList.add('is-in'); return; }
  if (reduced) { impression.classList.add('is-in'); return; }
  let pressing = false;
  const press = (delay = 0) => {
    pressing = true;
    S.play(delay + 1.9);
    gsap.timeline({ delay, onComplete: () => (pressing = false) })
      .to(S.press, { t: 1, duration: .42, ease: 'power3.in' })
      .add(() => impression.classList.add('is-in'))
      .to(S.press, { t: 0, duration: 1.2, ease: 'elastic.out(1, .5)' }, '+=.12');
  };
  whenVisible(stage, () => press(.5), { rootMargin: '0px 0px -25% 0px' });
  stage.addEventListener(isTouch ? 'click' : 'pointerdown', (e) => { if (!e.button && !pressing) press(0); });
}

boot(async () => { billing(); }, () => { rubberStamp(); });
