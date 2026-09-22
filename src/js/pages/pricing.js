import '../../styles/main.css';
import '../../styles/pages/pricing.css';
import { boot, gsap, ScrollTrigger, reduced, isTouch, suspend } from '../main.js';
import { createStamp } from '../stamp3d.js';

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
  const S = await createStamp(canvas, stage, { mode: 'tip' });

  if (!isTouch) window.addEventListener('pointermove', (e) => { const r = stage.getBoundingClientRect(); S.setPointer(((e.clientX - r.left) / r.width - .5) * 2, ((e.clientY - r.top) / r.height - .5) * 2); });
  if (!reduced) ScrollTrigger.create({ trigger: stage, start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? S.start() : S.stop()) });

  /* the press: scroll from the hero into the plans pushes the stamp down and leaves an impression */
  if (!reduced) {
    gsap.timeline({ scrollTrigger: { trigger: '.plans', start: 'top 95%', end: 'top 35%', scrub: .8 } })
      .to(S.press, { t: 1, ease: 'power3.in' }, 0)
      .to(impression, { opacity: .9, scale: 1, ease: 'expo.out', duration: .3 }, .7)
      .to(S.press, { t: 0, ease: 'elastic.out(1, .5)' }, 1);
  }

  /* drag to spin */
  let dragging = false, lastX = 0;
  stage.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.style.cursor = 'grabbing'; });
  window.addEventListener('pointermove', (e) => { if (!dragging) return; const dx = e.clientX - lastX; lastX = e.clientX; S.nudgeSpin(dx * 40); });
  const release = () => { dragging = false; canvas.style.cursor = 'grab'; };
  window.addEventListener('pointerup', release); window.addEventListener('pointercancel', release); /* a scroll that starts on the stamp cancels the pointer; never leave it "dragging" */
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
