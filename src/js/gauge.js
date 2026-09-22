/* The Trulinq Score gauge: one shared piece of artwork for the homepage, profiles and the dashboard. */
import { gsap, ScrollTrigger, reduced } from './main.js';
import { FACTORS, scoreOf, gradeOf, pct } from './ui.js';

export function gaugeHTML({ caption = '', id = 'g' + Math.random().toString(36).slice(2, 6) } = {}) {
  return `<div class="gauge-wrap" data-gauge-root>
    <svg viewBox="0 0 320 300" class="gauge" aria-hidden="true">
      <defs><linearGradient id="grad-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4AB3FF"/><stop offset=".55" stop-color="#2981FB"/><stop offset="1" stop-color="#093DA1"/></linearGradient></defs>
      <path class="gauge__track" d="M 40 236 A 130 130 0 1 1 280 236" fill="none" stroke="var(--gauge-track, #EAF1FA)" stroke-width="22" stroke-linecap="round"/>
      <path class="gauge__ticks" d="${ticksPath()}" fill="none" stroke="#0C1526" stroke-opacity=".18" stroke-width="2"/>
      <path class="gauge__ticks gauge__ticks--lit" d="${ticksPath()}" fill="none" stroke="#2981FB" stroke-width="2" data-ticks-lit/>
      <path class="gauge__fill" d="M 40 236 A 130 130 0 1 1 280 236" fill="none" stroke="url(#grad-${id})" stroke-width="22" stroke-linecap="round" data-gauge-fill/>
      <circle class="gauge__pulse" r="9" fill="none" stroke="#2981FB" stroke-width="3" opacity="0" data-pulse cx="40" cy="236"/>
      <circle class="gauge__knob" r="9" fill="#FFFFFF" stroke="#2981FB" stroke-width="5" data-knob cx="40" cy="236"/>
      <text x="34" y="272" class="gauge__lbl mono">300</text>
      <text x="286" y="272" class="gauge__lbl mono" text-anchor="end">850</text>
    </svg>
    <div class="score__readout">
      <span class="score__num mono" data-score-num><span class="sr-only" data-score-text>300</span>${odometerHTML()}</span>
      <span class="score__grade"><b data-score-grade>—</b><span data-score-band>Building</span></span>
    </div>
    ${caption ? `<p class="score__caption">${caption}</p>` : ''}
  </div>`;
}

/* The number is a real odometer: three reels of 0-9 (plus a 0 to wrap into). Each reel rolls only while the digit
   below it turns over, so it reads like a mechanical counter settling on the score. */
function odometerHTML() {
  return `<span class="odo" aria-hidden="true">${[2, 1, 0].map((p) => `<span class="odo__col"><span class="odo__reel" data-odo="${p}">${'01234567890'.split('').map((d) => `<i>${d}</i>`).join('')}</span></span>`).join('')}</span>`;
}

export function ticksPath() {
  const cx = 160, cy = 186, r1 = 100, r2 = 106;
  const t0 = Math.atan2(236 - cy, 40 - cx), t1 = Math.atan2(236 - cy, 280 - cx) + Math.PI * 2;
  let d = '';
  for (let i = 0; i <= 22; i++) { const a = t0 + ((t1 - t0) * i) / 22; const c = Math.cos(a), sn = Math.sin(a); const ri = i % 11 === 0 ? r1 - 5 : r1; d += `M${(cx + ri * c).toFixed(1)} ${(cy + ri * sn).toFixed(1)}L${(cx + r2 * c).toFixed(1)} ${(cy + r2 * sn).toFixed(1)}`; }
  return d;
}

export function factorNotes(m) {
  const months = Math.max(1, Math.round((new Date('2026-09-18') - new Date(m.joined)) / (30.4 * 864e5)));
  const held = Math.max(0, Math.round((new Date('2026-09-18') - new Date(m.verifiedOn)) / (30.4 * 864e5)));
  const [, profile, web] = m.factors;
  return [
    'ID and business documents reviewed and approved',
    `${Math.round((profile / 20) * 8)} of 8 profile details provided`,
    web === 15 ? 'Secure business website linked' : web > 0 ? 'Website linked, domain not yet confirmed' : 'No business website linked yet',
    `On Trulinq for ${months} month${months === 1 ? '' : 's'}`,
    `Stamp held for ${held} month${held === 1 ? '' : 's'} with no revocation`
  ];
}

export function factorsHTML(m) {
  const notes = factorNotes(m);
  return `<ul class="factors" data-factors>${FACTORS.map((f, i) => `<li class="factor" data-factor="${m.factors[i]}" data-max="${f.max}"><div class="factor__row"><span>${f.label}</span><b class="mono">${m.factors[i]}<small>/${f.max}</small></b></div><div class="factor__bar"><i style="--pct:${(m.factors[i] / f.max) * 100}"></i></div><p>${notes[i]}</p></li>`).join('')}</ul>`;
}

/* Animate a mounted gauge to a member's score. */
export function runGauge(root, factors, { trigger = root, start = 'top 58%', delay = 0 } = {}) {
  const target = scoreOf(factors);
  const fill = root.querySelector('[data-gauge-fill]');
  const knob = root.querySelector('[data-knob]');
  const num = root.querySelector('[data-score-num]');
  const gradeEl = root.querySelector('[data-score-grade]');
  const bandEl = root.querySelector('[data-score-band]');
  const pulse = root.querySelector('[data-pulse]');
  const text = root.querySelector('[data-score-text]');
  const reels = [...root.querySelectorAll('[data-odo]')];
  const badge = gradeEl.parentElement;
  const lit = root.querySelector('[data-ticks-lit]');
  const readout = root.querySelector('.score__readout');
  const L = fill.getTotalLength(), TL = lit.getTotalLength();
  fill.style.strokeDasharray = L; fill.style.strokeDashoffset = L;
  lit.style.strokeDasharray = TL; lit.style.strokeDashoffset = TL;
  const state = { p: 0 };
  let last = 300, lastGrade = '';
  /* place every reel for a (fractional) score: the ones reel rolls continuously, each higher reel turns over only
     while the reel below passes from 9 to 0; the faster a reel moves, the more it blurs */
  const setNumber = (s, blur) => {
    text.textContent = Math.round(s);
    reels.forEach((reel) => {
      const p = +reel.dataset.odo, base = 10 ** p;
      const v = p === 0 ? s % 10 : Math.floor(s / base) % 10 + Math.max(0, (s % base) - (base - 1));
      reel.style.transform = `translate3d(0, ${(-v).toFixed(4)}em, 0)`;
      if (blur !== undefined) reel.style.filter = blur / base > .25 ? `blur(${Math.min(5, blur / base * .35).toFixed(2)}px)` : '';
    });
  };
  const apply = (animated = false) => {
    const p = state.p;
    fill.style.strokeDashoffset = L * (1 - p);
    lit.style.strokeDashoffset = TL * (1 - p); /* the ticks light up as the knob passes them */
    const pt = fill.getPointAtLength(L * p);
    knob.setAttribute('cx', pt.x.toFixed(2)); knob.setAttribute('cy', pt.y.toFixed(2));
    pulse.setAttribute('cx', pt.x.toFixed(2)); pulse.setAttribute('cy', pt.y.toFixed(2));
    const s = 300 + p * 550;
    setNumber(s, animated ? Math.abs(s - last) : undefined); last = s;
    const g = gradeOf(Math.round(s)); gradeEl.textContent = g.grade; bandEl.textContent = g.band;
    /* every grade the score climbs through gets its own little pop */
    if (animated && g.grade !== lastGrade && lastGrade) gsap.fromTo(badge, { scale: .86 }, { scale: 1, duration: .7, ease: 'elastic.out(1, .45)', overwrite: true });
    lastGrade = g.grade;
  };
  apply();
  const bars = root.closest('section, main, body').querySelectorAll('.factor__bar i');
  const wrap = root.closest('.gauge-wrap') || root;
  const run = () => {
    gsap.timeline({ delay })
      /* the readout rises into place as the count begins */
      .fromTo(readout, { opacity: 0, y: 18, scale: .94 }, { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: 'expo.out' }, 0)
      /* the count: fast off the mark, a long settle */
      .to(state, { p: (target - 300) / 550, duration: 3, ease: 'expo.out', onUpdate: () => apply(true) }, .08)
      .to(bars, { scaleX: 1, duration: 1.4, ease: 'expo.out', stagger: .12 }, .2)
      /* the landing: the number settles with a spring, a glint crosses the digits, the knob sends out a ring */
      .add(() => { reels.forEach((r) => (r.style.filter = '')); wrap.classList.add('is-done'); }, 2.9)
      .fromTo(num, { scale: 1.05 }, { scale: 1, duration: 1, ease: 'elastic.out(1, .4)' }, 2.9)
      .fromTo(pulse, { attr: { r: 9 }, opacity: .9 }, { attr: { r: 34 }, opacity: 0, duration: 1.1, ease: 'power2.out' }, 2.95);
  };
  if (reduced) { state.p = (target - 300) / 550; apply(); gsap.set(bars, { scaleX: 1 }); wrap.classList.add('is-done'); return; }
  gsap.set(readout, { opacity: 0 });
  /* starts once the gauge itself is well inside the viewport (its top past the middle of the screen), the first time
     the reader scrolls onto it, and never again */
  ScrollTrigger.create({ trigger: typeof trigger === 'string' ? document.querySelector(trigger) || root : trigger, start, once: true, onEnter: run });
}
