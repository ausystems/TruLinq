/* The Trulinq mascot: a flat royal-blue monk seal with its stamp. One drawing and one set of behaviours, shared by the
   homepage hero, the how-it-works stage, the FAQ and the 404. Every part is a data-m-* group and every transform lives
   on its own group, so the review choreography, the idle loops and the click reaction never fight over a property. */
import { gsap, reduced, isTouch } from './main.js';

export const SMILE = 'M150 154 q10 9 20 0';
export const PURSED = 'M150 156 q10 -3 20 0';

export function mascotSVG({ cls = 'mascot mascot--full', marks = true } = {}) {
  return `<svg viewBox="0 0 320 320" class="${cls}" overflow="visible" aria-hidden="true">
    <ellipse data-m-shadow cx="160" cy="292" rx="120" ry="14" fill="#0C1526" opacity=".1"/>
    <g data-m-body>
      <path d="M62 244 C 40 200, 70 150, 160 148 C 250 150, 280 200, 258 244 C 246 270, 200 290, 160 288 C 120 290, 74 270, 62 244 Z" fill="#1545A2"/>
      <ellipse cx="160" cy="240" rx="58" ry="40" fill="#F4F7FB"/>
      <path d="M78 214 C 40 226, 30 262, 62 268 C 84 272, 96 250, 92 232 Z" fill="#1545A2"/>
      <path data-m-flipper d="M242 214 C 280 226, 290 262, 258 268 C 236 272, 224 250, 228 232 Z" fill="#1545A2"/>
      <g data-m-head>
        <circle cx="160" cy="130" r="72" fill="#1545A2"/>
        <ellipse cx="160" cy="154" rx="38" ry="26" fill="#F4F7FB"/>
        <g data-m-eye>
          <circle cx="134" cy="118" r="11" fill="#F4F7FB"/>
          <g data-m-pupil><circle cx="136" cy="119" r="6" fill="#060D19"/><circle cx="138.5" cy="116.5" r="2" fill="#fff"/></g>
        </g>
        <g data-m-eye>
          <circle cx="186" cy="118" r="11" fill="#F4F7FB"/>
          <g data-m-pupil><circle cx="188" cy="119" r="6" fill="#060D19"/><circle cx="190.5" cy="116.5" r="2" fill="#fff"/></g>
        </g>
        <ellipse cx="160" cy="142" rx="9" ry="6.5" fill="#060D19"/>
        <path data-m-mouth d="${SMILE}" stroke="#060D19" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="118" cy="146" r="7" fill="#4AB3FF" opacity=".55"/><circle cx="202" cy="146" r="7" fill="#4AB3FF" opacity=".55"/>
        <path data-m-whiskers d="M126 148 l-26 -6 M126 154 l-26 4 M194 148 l26 -6 M194 154 l26 4" stroke="#F4F7FB" stroke-width="2.4" stroke-linecap="round"/>
      </g>
      <g data-m-arm>
        <g class="mascot__stamp" data-m-stamp transform="translate(252 150)">
          <rect x="-10" y="-38" width="20" height="30" rx="6" fill="#0C1526"/>
          <circle cx="0" cy="8" r="30" fill="#2981FB"/>
          <path d="M-14 9 l9 9 l19 -21" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        </g>
      </g>
    </g>
    ${marks ? '<g data-m-q opacity="0"><text x="62" y="92" font-family="Geist, sans-serif" font-weight="600" font-size="44" fill="#4AB3FF" transform="rotate(-12 62 92)">?</text></g>' : ''}
  </svg>`;
}

/* Collect the parts and set every pivot (viewBox units). */
export function mascotParts(root) {
  if (!root) return null;
  const q = (s) => root.querySelector(s);
  const p = {
    root, svg: root.querySelector('svg'),
    shadow: q('[data-m-shadow]'), body: q('[data-m-body]'), head: q('[data-m-head]'), flipper: q('[data-m-flipper]'),
    eyes: root.querySelectorAll('[data-m-eye]'), pupils: root.querySelectorAll('[data-m-pupil]'),
    mouth: q('[data-m-mouth]'), whiskers: q('[data-m-whiskers]'), arm: q('[data-m-arm]'), stamp: q('[data-m-stamp]'), mark: q('[data-m-q]')
  };
  gsap.set(p.body, { svgOrigin: '160 288' });
  gsap.set(p.head, { svgOrigin: '160 200' });
  gsap.set(p.eyes[0], { svgOrigin: '134 118' });
  gsap.set(p.eyes[1], { svgOrigin: '186 118' });
  gsap.set(p.whiskers, { svgOrigin: '160 150' });
  gsap.set(p.flipper, { svgOrigin: '230 224' });
  gsap.set(p.arm, { transformOrigin: '50% 50%' });
  if (p.mark) gsap.set(p.mark, { transformOrigin: '50% 90%' });
  gsap.set(p.shadow, { svgOrigin: '160 292' });
  return p;
}

/* A blink: both lids drop and lift. A double blink reads as "done". */
export function blink(p, double = false) {
  const tl = gsap.timeline();
  tl.to(p.eyes, { scaleY: .06, duration: .07, ease: 'power2.in' }).to(p.eyes, { scaleY: 1, duration: .16, ease: 'power2.out' });
  if (double) tl.to(p.eyes, { scaleY: .06, duration: .07, ease: 'power2.in' }, '+=.1').to(p.eyes, { scaleY: 1, duration: .18, ease: 'power2.out' });
  return tl;
}

/* The starting pose for a review: off the floor, stamp raised, lips pursed. */
export function prime(p) {
  gsap.set(p.root, { y: 70, scale: .82, opacity: 0, transformOrigin: '50% 100%' });
  gsap.set(p.shadow, { scaleX: .5, opacity: 0 });
  gsap.set(p.arm, { y: -30, rotate: -14 });
  gsap.set(p.mouth, { attr: { d: PURSED } });
}

/* The review: the seal pops up, eyes the record, squints, winds up and thumps its stamp so that the impact lands at
   `land` seconds on the given timeline, then looks at you, smiles, double-blinks and starts its idle life. */
export function review(tl, p, { land = 1.4, idle: startIdle = true, hop = true } = {}) {
  const at = (d) => land + d;
  tl.to(p.root, { y: 0, scale: 1, opacity: 1, duration: 1.2, ease: 'elastic.out(1, .62)' }, at(-1.1))
    .to(p.shadow, { scaleX: 1, opacity: .1, duration: .7, ease: 'power2.out' }, at(-.95))
    .to(p.pupils, { x: 3, y: -2.5, duration: .4, ease: 'power2.out' }, at(-1.05));
  if (p.mark) tl.fromTo(p.mark, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(2.6)' }, at(-.9));
  tl.to(p.head, { rotate: 5, duration: .5, ease: 'power2.inOut' }, at(-.8))
    .to(p.eyes, { scaleY: .55, duration: .3, ease: 'power2.inOut' }, at(-.68));
  if (p.mark) tl.to(p.mark, { scale: .5, opacity: 0, duration: .14, ease: 'power2.in' }, at(-.52));
  tl.to(p.arm, { y: -46, rotate: -20, duration: .16, ease: 'power2.out' }, at(-.62))
    .to(p.flipper, { rotate: -14, duration: .16, ease: 'power2.out' }, at(-.62))
    .to(p.arm, { y: 28, rotate: 4, duration: .45, ease: 'power4.in' }, at(-.45))
    .to(p.flipper, { rotate: 6, duration: .45, ease: 'power4.in' }, at(-.45))
    .to(p.pupils, { x: 2, y: 3, duration: .3, ease: 'power2.in' }, at(-.3))
    /* impact */
    .to(p.body, { scaleY: .93, scaleX: 1.05, duration: .1, ease: 'power2.out' }, at(0))
    .to(p.head, { rotate: -3, duration: .1, ease: 'power2.out' }, at(0))
    .to(p.eyes, { scaleY: 1.16, scaleX: 1.08, duration: .1, ease: 'power2.out' }, at(0))
    .to(p.whiskers, { scaleX: 1.08, duration: .08, ease: 'power2.out' }, at(0))
    .to(p.shadow, { scaleX: 1.06, duration: .1, ease: 'power2.out' }, at(0))
    /* springs back */
    .to(p.body, { scaleY: 1, scaleX: 1, duration: .8, ease: 'elastic.out(1, .4)' }, at(.1))
    .to(p.head, { rotate: 0, duration: .8, ease: 'elastic.out(1, .45)' }, at(.1))
    .to(p.eyes, { scaleY: 1, scaleX: 1, duration: .6, ease: 'elastic.out(1, .5)' }, at(.1))
    .to(p.whiskers, { scaleX: 1, duration: .6, ease: 'elastic.out(1, .4)' }, at(.08))
    .to(p.shadow, { scaleX: 1, duration: .5, ease: 'power2.out' }, at(.1))
    .to(p.arm, { y: 0, rotate: 0, duration: .9, ease: 'elastic.out(1, .45)' }, at(.12))
    .to(p.flipper, { rotate: 0, duration: .8, ease: 'elastic.out(1, .45)' }, at(.12))
    /* looks at you, pleased */
    .to(p.pupils, { x: 0, y: 0, duration: .45, ease: 'power2.inOut' }, at(.3))
    .to(p.mouth, { attr: { d: SMILE }, duration: .5, ease: 'back.out(1.7)' }, at(.35))
    .add(blink(p, true), at(.75));
  if (startIdle) tl.add(() => idle(p, { hop }), at(1.2));
  return tl;
}

/* Idle life: breathing, the stamp's gentle tap, random blinks, cursor-following eyes and a startled hop on click. */
export function idle(p, { hop = true, follow = true } = {}) {
  if (reduced) return;
  gsap.to(p.root, { scaleY: 1.018, scaleX: 1.006, transformOrigin: '50% 100%', duration: 2.3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to(p.stamp, { rotate: -8, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '0px 40px' });

  let busy = false; /* true while a reaction owns the eyes and body */
  const nextBlink = () => gsap.delayedCall(gsap.utils.random(2.6, 6.2), () => { if (!busy && !gsap.isTweening(p.eyes[0])) blink(p, Math.random() < .25); nextBlink(); });
  nextBlink();

  if (follow && !isTouch) {
    const px = [...p.pupils].map((el) => gsap.quickTo(el, 'x', { duration: .55, ease: 'power3' }));
    const py = [...p.pupils].map((el) => gsap.quickTo(el, 'y', { duration: .55, ease: 'power3' }));
    const tilt = gsap.quickTo(p.head, 'rotation', { duration: .9, ease: 'power3' }); /* quickTo needs the canonical name */
    window.addEventListener('pointermove', (e) => {
      if (busy) return;
      const r = p.svg.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const dx = e.clientX - (r.left + r.width * .5), dy = e.clientY - (r.top + r.height * .37);
      const dist = Math.hypot(dx, dy) || 1, k = Math.min(1, dist / 220);
      px.forEach((f) => f((dx / dist) * 3.2 * k)); py.forEach((f) => f((dy / dist) * 3.4 * k));
      tilt(gsap.utils.clamp(-4, 4, dx / 140));
    }, { passive: true });
  }

  if (!hop) return;
  p.root.style.cursor = 'pointer';
  p.root.addEventListener('pointerdown', (e) => {
    if (busy || e.button) return;
    busy = true;
    const tl = gsap.timeline({ onComplete: () => (busy = false) })
      .to(p.body, { scaleY: .88, scaleX: 1.08, duration: .13, ease: 'power2.out' }, 0)
      .to(p.body, { scaleY: 1.07, scaleX: .95, duration: .16, ease: 'power2.out' }, .13)
      .to(p.root, { y: -38, duration: .3, ease: 'power2.out' }, .13)
      .to(p.shadow, { scaleX: .72, opacity: .04, duration: .3, ease: 'power2.out' }, .13)
      .to(p.root, { y: 0, duration: .55, ease: 'bounce.out' }, .43)
      .to(p.shadow, { scaleX: 1, opacity: .1, duration: .35, ease: 'power2.out' }, .43)
      .to(p.body, { scaleY: .93, scaleX: 1.05, duration: .09, ease: 'power2.out' }, .43)
      .to(p.body, { scaleY: 1, scaleX: 1, duration: .8, ease: 'elastic.out(1, .4)' }, .52)
      .to(p.eyes, { scaleY: 1.18, scaleX: 1.08, duration: .12, ease: 'power2.out' }, .05)
      .to(p.eyes, { scaleY: 1, scaleX: 1, duration: .5, ease: 'elastic.out(1, .5)' }, .5)
      .add(blink(p, true), 1)
      .to(p.arm, { y: -18, rotate: -12, duration: .2, ease: 'power2.out' }, .1)
      .to(p.arm, { y: 0, rotate: 0, duration: .9, ease: 'elastic.out(1, .42)' }, .4)
      .to(p.mouth, { attr: { d: 'M150 152 q10 12 20 0' }, duration: .3, ease: 'power2.out' }, .1)
      .to(p.mouth, { attr: { d: SMILE }, duration: .5, ease: 'power2.inOut' }, 1.1);
    if (p.mark) tl.fromTo(p.mark, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(2.6)' }, .08).to(p.mark, { scale: .5, opacity: 0, duration: .28, ease: 'power2.in' }, 1.15);
  });
}

/* A killable idle for scenes that come and go (the pinned "Earn the stamp" stage): breathing, the stamp's tap and
   random blinks, with a kill() that stops the loops and puts every part back to rest. */
export function liveIdle(p) {
  if (reduced) return { kill() {} };
  let alive = true, call = null;
  const loops = [
    gsap.to(p.root, { scaleY: 1.018, scaleX: 1.006, transformOrigin: '50% 100%', duration: 2.3, yoyo: true, repeat: -1, ease: 'sine.inOut' }),
    gsap.to(p.stamp, { rotate: -8, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '0px 40px' })
  ];
  const next = () => { call = gsap.delayedCall(gsap.utils.random(2.4, 5.5), () => { if (!alive) return; if (!gsap.isTweening(p.eyes[0])) blink(p, Math.random() < .25); next(); }); };
  next();
  return {
    kill() {
      if (!alive) return; alive = false;
      loops.forEach((t) => t.kill()); call && call.kill(); gsap.killTweensOf(p.eyes);
      gsap.set(p.root, { scaleX: 1, scaleY: 1 }); gsap.set(p.stamp, { rotate: 0 }); gsap.set(p.eyes, { scaleY: 1, scaleX: 1 });
    }
  };
}
