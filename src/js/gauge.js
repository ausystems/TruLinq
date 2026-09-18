/* The Trulinq Score gauge: one shared piece of artwork for the homepage, profiles and the dashboard. */
import { gsap, ScrollTrigger, reduced } from './main.js';
import { FACTORS, scoreOf, gradeOf, pct } from './ui.js';

export function gaugeHTML({ caption = '', id = 'g' + Math.random().toString(36).slice(2, 6) } = {}) {
  return `<div class="gauge-wrap" data-gauge-root>
    <svg viewBox="0 0 320 300" class="gauge" aria-hidden="true">
      <defs><linearGradient id="grad-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#F9C6AF"/><stop offset=".55" stop-color="#F8501A"/><stop offset="1" stop-color="#D9410F"/></linearGradient></defs>
      <path class="gauge__track" d="M 40 236 A 130 130 0 1 1 280 236" fill="none" stroke="var(--gauge-track, #fff)" stroke-width="22" stroke-linecap="round"/>
      <path class="gauge__ticks" d="${ticksPath()}" fill="none" stroke="#050347" stroke-opacity=".18" stroke-width="2"/>
      <path class="gauge__fill" d="M 40 236 A 130 130 0 1 1 280 236" fill="none" stroke="url(#grad-${id})" stroke-width="22" stroke-linecap="round" data-gauge-fill/>
      <circle class="gauge__knob" r="9" fill="#fff" stroke="#F8501A" stroke-width="5" data-knob cx="40" cy="236"/>
      <text x="34" y="272" class="gauge__lbl mono">300</text>
      <text x="286" y="272" class="gauge__lbl mono" text-anchor="end">850</text>
    </svg>
    <div class="score__readout">
      <span class="score__num mono" data-score-num>300</span>
      <span class="score__grade"><b data-score-grade>—</b><span data-score-band>Building</span></span>
    </div>
    ${caption ? `<p class="score__caption">${caption}</p>` : ''}
  </div>`;
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
export function runGauge(root, factors, { trigger = root, delay = 0 } = {}) {
  const target = scoreOf(factors);
  const fill = root.querySelector('[data-gauge-fill]');
  const knob = root.querySelector('[data-knob]');
  const num = root.querySelector('[data-score-num]');
  const gradeEl = root.querySelector('[data-score-grade]');
  const bandEl = root.querySelector('[data-score-band]');
  const L = fill.getTotalLength();
  fill.style.strokeDasharray = L; fill.style.strokeDashoffset = L;
  const state = { p: 0 };
  const apply = () => {
    const p = state.p;
    fill.style.strokeDashoffset = L * (1 - p);
    const pt = fill.getPointAtLength(L * p);
    knob.setAttribute('cx', pt.x.toFixed(2)); knob.setAttribute('cy', pt.y.toFixed(2));
    const s = Math.round(300 + p * 550);
    num.textContent = s;
    const g = gradeOf(s); gradeEl.textContent = g.grade; bandEl.textContent = g.band;
  };
  apply();
  const bars = root.closest('section, main, body').querySelectorAll('.factor__bar i');
  const run = () => {
    gsap.to(state, { p: pct(target) / 100, duration: 2.4, ease: 'expo.out', delay, onUpdate: apply });
    gsap.to(bars, { scaleX: 1, duration: 1.4, ease: 'expo.out', stagger: .12, delay: delay + .2 });
  };
  if (reduced) { state.p = pct(target) / 100; apply(); gsap.set(bars, { scaleX: 1 }); return; }
  ScrollTrigger.create({ trigger, start: 'top 78%', once: true, onEnter: run });
}
