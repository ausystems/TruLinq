import '../../styles/main.css';
import '../../styles/pages/pricing.css';
import { boot, reduced } from '../main.js';
import { BILLING } from '../../data/billing.js';
import { slipStamp } from '../slip-stamp.js';

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
   The plan lies on the desk as a slip of paper, placed so its seal sits exactly under the stamp's landing spot
   (src/js/slip-stamp.js). The stamp presses once as the page arrives (or as the stage comes into view, on a phone)
   and again when clicked or tapped. Without WebGL the slip lies there already stamped. */
function rubberStamp() {
  const stage = document.querySelector('[data-stamp-stage]');
  const slip = stage.querySelector('[data-slip]');
  slipStamp(stage, { desk: stage.querySelector('.phero-p__desk'), canvas: stage.querySelector('[data-stamp-canvas]'), slip, seal: slip.querySelector('[data-slip-seal]') });
}

boot(async () => { billing(); }, () => { rubberStamp(); });
