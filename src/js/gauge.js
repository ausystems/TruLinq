/* The Trulinq Score gauge: one shared piece of artwork for the homepage, profiles and the dashboard.
   The reading plays once, the first time the gauge is on screen, and never replays. */
import { gsap, reduced, whenVisible } from './main.js';
import { FACTORS, scoreOf, gradeOf, esc, fmtDate } from './ui.js';

let gaugeN = 0;
export function gaugeHTML({ caption = '', href: link = '' } = {}) {
  const id = `g${++gaugeN}`;
  const cap = caption ? `<p class="score__caption">${link ? `<a class="link" href="${esc(link)}">${esc(caption)}</a>` : esc(caption)}</p>` : '';
  return `<div class="gauge-wrap" data-gauge-root>
    <svg viewBox="0 0 320 300" class="gauge" aria-hidden="true">
      <defs><linearGradient id="grad-${id}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4AB3FF"/><stop offset=".55" stop-color="#2981FB"/><stop offset="1" stop-color="#093DA1"/></linearGradient></defs>
      <path class="gauge__track" d="M 40 236 A 130 130 0 1 1 280 236" fill="none" stroke="var(--gauge-track, #E3EBF6)" stroke-width="22" stroke-linecap="round"/>
      <path class="gauge__ticks" d="${ticksPath()}" fill="none" stroke="#0C1526" stroke-opacity=".18" stroke-width="2"/>
      <path class="gauge__ticks gauge__ticks--lit" d="${ticksPath()}" fill="none" stroke="#2981FB" stroke-width="2" data-ticks-lit/>
      <path class="gauge__fill" d="M 40 236 A 130 130 0 1 1 280 236" fill="none" stroke="url(#grad-${id})" stroke-width="22" stroke-linecap="round" data-gauge-fill/>
      <circle class="gauge__pulse" r="9" fill="none" stroke="#2981FB" stroke-width="3" opacity="0" data-pulse cx="40" cy="236"/>
      <circle class="gauge__knob" r="9" fill="#FFFFFF" stroke="#2981FB" stroke-width="5" data-knob cx="40" cy="236"/>
      <text x="34" y="272" class="gauge__lbl">300</text>
      <text x="286" y="272" class="gauge__lbl" text-anchor="end">850</text>
    </svg>
    <div class="score__readout">
      <span class="score__num" data-score-num><span class="sr-only" data-score-text>300</span>${odometerHTML()}</span>
      <span class="score__grade"><b data-score-grade>D</b><span data-score-band>Building</span></span>
    </div>
    ${cap}
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

/* What each factor rests on, in words that stay true for every member: facts and dates from the record, never a
   count the visible profile could contradict. */
export function factorNotes(m) {
  const [identity, profile, web] = m.factors;
  const verified = (m.status || 'verified') === 'verified' && m.verifiedOn;
  return [
    identity ? `ID and business approved by a reviewer${verified ? ` on ${fmtDate(m.verifiedOn)}` : ''}` : m.status === 'pending' ? 'Application in review' : 'Identity and business not verified yet',
    profile >= 20 ? 'Every profile detail the score counts is filled in' : profile > 0 ? 'Photo, bio, business details, website, offers and needs each add points' : 'No profile details yet',
    web >= 15 ? 'Web presence confirmed' : web > 0 ? 'Website linked, not confirmed yet' : 'No website linked',
    m.joined ? `On Trulinq since ${fmtDate(m.joined)}` : 'Joined recently',
    verified ? `Stamp held since ${fmtDate(m.verifiedOn)}, never revoked` : 'No stamp held yet'
  ];
}

export function factorsHTML(m) {
  const notes = factorNotes(m);
  return `<ul class="factors" data-factors>${FACTORS.map((f, i) => `<li class="factor"><div class="factor__row"><span>${f.label}</span><b>${m.factors[i]}<small>/${f.max}</small></b></div><div class="factor__bar" aria-hidden="true"><i style="--pct:${(m.factors[i] / f.max) * 100}"></i></div><p>${esc(notes[i])}</p></li>`).join('')}</ul>`;
}

/* Mount a gauge's reading. It plays the first time `trigger` is on screen, then stays. */
export function runGauge(root, factors, { trigger = root, delay = 0 } = {}) {
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
     while the reel below passes from 9 to 0 */
  const setNumber = (s, blur) => {
    text.textContent = Math.round(s);
    reels.forEach((reel) => {
      const p = +reel.dataset.odo, base = 10 ** p;
      const v = p === 0 ? s % 10 : Math.floor(s / base) % 10 + Math.max(0, (s % base) - (base - 1));
      reel.style.transform = `translate3d(0, ${(-v).toFixed(4)}em, 0)`;
      if (blur !== undefined) reel.style.filter = blur / base > .25 ? `blur(${Math.min(4, blur / base * .3).toFixed(2)}px)` : '';
    });
  };
  const apply = (animated = false) => {
    const p = state.p;
    fill.style.strokeDashoffset = L * (1 - p);
    lit.style.strokeDashoffset = TL * (1 - p);
    const pt = fill.getPointAtLength(L * p);
    knob.setAttribute('cx', pt.x.toFixed(2)); knob.setAttribute('cy', pt.y.toFixed(2));
    pulse.setAttribute('cx', pt.x.toFixed(2)); pulse.setAttribute('cy', pt.y.toFixed(2));
    const s = 300 + p * 550;
    setNumber(s, animated ? Math.abs(s - last) : undefined); last = s;
    const g = gradeOf(Math.round(s)); gradeEl.textContent = g.grade; bandEl.textContent = g.band;
    if (animated && g.grade !== lastGrade && lastGrade) gsap.fromTo(badge, { scale: .9 }, { scale: 1, duration: .6, ease: 'elastic.out(1, .5)', overwrite: true });
    lastGrade = g.grade;
  };
  const scope = root.closest('section, main') || document;
  const bars = scope.querySelectorAll('.factor__bar i');
  const wrap = root.closest('.gauge-wrap') || root;
  const finish = () => { state.p = (target - 300) / 550; apply(); bars.forEach((b) => (b.style.transform = 'none')); wrap.classList.add('is-done'); };
  if (reduced) { finish(); return; }
  apply();
  /* nothing is read out before the reading starts: a score of 300 would be a false statement about the member */
  gsap.set(readout, { opacity: 0 });
  const run = () => {
    gsap.timeline({ delay })
      .to(readout, { opacity: 1, duration: .5, ease: 'power2.out' }, 0)
      .to(state, { p: (target - 300) / 550, duration: 2.6, ease: 'expo.out', onUpdate: () => apply(true) }, 0)
      .to(bars, { scaleX: 1, duration: 1.2, ease: 'expo.out', stagger: .1 }, .15)
      .add(() => { reels.forEach((r) => (r.style.filter = '')); wrap.classList.add('is-done'); }, 2.4)
      .fromTo(num, { scale: 1.04 }, { scale: 1, duration: .9, ease: 'elastic.out(1, .45)' }, 2.4)
      .fromTo(pulse, { attr: { r: 9 }, opacity: .8 }, { attr: { r: 30 }, opacity: 0, duration: 1, ease: 'power2.out' }, 2.45);
  };
  const el = typeof trigger === 'string' ? document.querySelector(trigger) || root : trigger;
  whenVisible(el, run, { rootMargin: '0px 0px -30% 0px' });
}
