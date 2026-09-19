import '../../styles/main.css';
import '../../styles/pages/notfound.css';
import { boot, gsap, reduced, isTouch, go } from '../main.js';
import { href, BASE } from '../ui.js';

function build() {
  const path = location.pathname.startsWith(BASE) ? '/' + location.pathname.slice(BASE.length) : location.pathname;
  document.querySelector('[data-nf-path]').textContent = path || '/';
  document.querySelector('[data-nf-time]').textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  document.querySelector('[data-nf-search]').addEventListener('submit', (e) => { e.preventDefault(); const q = document.querySelector('#nf-q').value.trim(); go(href('/directory/') + (q ? '?q=' + encodeURIComponent(q) : ''), 'Directory'); });
}

/* ── The reviewer ──────────────────────────────────────────────────
   The seal is the one who stamps the record. Its parts are addressed by data-m-* groups; every transform is on
   its own group so the intro, the idle loops and the click reaction never fight over a property. */
const SMILE = 'M150 154 q10 9 20 0';
const PURSED = 'M150 156 q10 -3 20 0';

function reviewer() {
  const root = document.querySelector('[data-nf-mascot]');
  if (!root) return null;
  const q = (s) => root.querySelector(s);
  const parts = {
    root, svg: root.querySelector('svg'),
    shadow: q('[data-m-shadow]'), body: q('[data-m-body]'), head: q('[data-m-head]'), flipper: q('[data-m-flipper]'),
    eyes: root.querySelectorAll('[data-m-eye]'), pupils: root.querySelectorAll('[data-m-pupil]'),
    mouth: q('[data-m-mouth]'), whiskers: q('[data-m-whiskers]'), arm: q('[data-m-arm]'), stamp: q('[data-m-stamp]'), mark: q('[data-m-q]')
  };
  /* pivots, in viewBox units */
  gsap.set(parts.body, { svgOrigin: '160 288' });
  gsap.set(parts.head, { svgOrigin: '160 200' });
  gsap.set(parts.eyes[0], { svgOrigin: '134 118' });
  gsap.set(parts.eyes[1], { svgOrigin: '186 118' });
  gsap.set(parts.whiskers, { svgOrigin: '160 150' });
  gsap.set(parts.flipper, { svgOrigin: '230 224' });
  gsap.set(parts.arm, { transformOrigin: '50% 50%' });
  gsap.set(parts.mark, { transformOrigin: '50% 90%' });
  gsap.set(parts.shadow, { svgOrigin: '160 292' });
  return parts;
}

/* A blink: both lids drop and lift. A double blink reads as "done". */
function blink(p, double = false) {
  const tl = gsap.timeline();
  tl.to(p.eyes, { scaleY: .06, duration: .07, ease: 'power2.in' }).to(p.eyes, { scaleY: 1, duration: .16, ease: 'power2.out' });
  if (double) tl.to(p.eyes, { scaleY: .06, duration: .07, ease: 'power2.in' }, '+=.1').to(p.eyes, { scaleY: 1, duration: .18, ease: 'power2.out' });
  return tl;
}

/* Idle life after the record is stamped: breathing, the stamp's gentle tap, blinks, cursor-following eyes, a hop on click. */
function idle(p) {
  gsap.to(p.root, { scaleY: 1.018, scaleX: 1.006, transformOrigin: '50% 100%', duration: 2.3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to(p.stamp, { rotate: -8, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut', transformOrigin: '0px 40px' });

  let busy = false; /* true while a reaction owns the eyes and body */
  const nextBlink = () => gsap.delayedCall(gsap.utils.random(2.6, 6.2), () => { if (!busy && !gsap.isTweening(p.eyes[0])) blink(p, Math.random() < .25); nextBlink(); });
  nextBlink();

  if (!isTouch) {
    const px = [...p.pupils].map((el) => gsap.quickTo(el, 'x', { duration: .55, ease: 'power3' }));
    const py = [...p.pupils].map((el) => gsap.quickTo(el, 'y', { duration: .55, ease: 'power3' }));
    const tilt = gsap.quickTo(p.head, 'rotation', { duration: .9, ease: 'power3' }); /* quickTo needs the canonical name */
    window.addEventListener('pointermove', (e) => {
      if (busy) return;
      const r = p.svg.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width * .5), dy = e.clientY - (r.top + r.height * .37);
      const dist = Math.hypot(dx, dy) || 1, k = Math.min(1, dist / 220);
      px.forEach((f) => f((dx / dist) * 3.2 * k)); py.forEach((f) => f((dy / dist) * 3.4 * k));
      tilt(gsap.utils.clamp(-4, 4, dx / 140));
    }, { passive: true });
  }

  /* Click: a startled little hop, a "?", and the stamp lifts and settles */
  p.root.addEventListener('pointerdown', (e) => {
    if (busy || e.button) return;
    busy = true;
    gsap.timeline({ onComplete: () => (busy = false) })
      .to(p.body, { scaleY: .88, scaleX: 1.08, duration: .13, ease: 'power2.out' }, 0)
      .to(p.body, { scaleY: 1.07, scaleX: .95, duration: .16, ease: 'power2.out' }, .13)
      .to(p.root, { y: -38, duration: .3, ease: 'power2.out' }, .13)
      .to(p.shadow, { scaleX: .72, opacity: .035, duration: .3, ease: 'power2.out' }, .13)
      .to(p.root, { y: 0, duration: .55, ease: 'bounce.out' }, .43)
      .to(p.shadow, { scaleX: 1, opacity: .08, duration: .35, ease: 'power2.out' }, .43)
      .to(p.body, { scaleY: .93, scaleX: 1.05, duration: .09, ease: 'power2.out' }, .43)
      .to(p.body, { scaleY: 1, scaleX: 1, duration: .8, ease: 'elastic.out(1, .4)' }, .52)
      .to(p.eyes, { scaleY: 1.18, scaleX: 1.08, duration: .12, ease: 'power2.out' }, .05)
      .to(p.eyes, { scaleY: 1, scaleX: 1, duration: .5, ease: 'elastic.out(1, .5)' }, .5)
      .add(blink(p, true), 1)
      .to(p.arm, { y: -18, rotate: -12, duration: .2, ease: 'power2.out' }, .1)
      .to(p.arm, { y: 0, rotate: 0, duration: .9, ease: 'elastic.out(1, .42)' }, .4)
      .fromTo(p.mark, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(2.6)' }, .08)
      .to(p.mark, { scale: .5, opacity: 0, duration: .28, ease: 'power2.in' }, 1.15)
      .to(p.mouth, { attr: { d: 'M150 152 q10 12 20 0' }, duration: .3, ease: 'power2.out' }, .1)
      .to(p.mouth, { attr: { d: SMILE }, duration: .5, ease: 'power2.inOut' }, 1.1);
  });
}

function hero() {
  const input = document.querySelector('#nf-q');
  const digits = document.querySelectorAll('[data-digit]');
  const stamp = document.querySelector('[data-nf-stamp]');
  const rows = document.querySelectorAll('[data-nf-ledger] .ledger__row');
  if (reduced) { input.focus({ preventScroll: true }); return; }
  const p = reviewer();
  gsap.set(rows, { opacity: 0, x: -10 });
  const tl = gsap.timeline({ onComplete: () => input.focus({ preventScroll: true }) })
    .from(digits, { y: -90, opacity: 0, duration: 1.1, ease: 'elastic.out(1, .55)', stagger: .12 }, .1)
    /* the stamp slams across the record */
    .fromTo(stamp, { opacity: 0, scale: 2.1, rotate: -26, x: 0, y: 0, xPercent: -50, yPercent: -50 }, { opacity: 1, scale: 1, rotate: -12, x: 0, y: 0, xPercent: -50, yPercent: -50, duration: .45, ease: 'power4.in' }, .95)
    .to(digits, { y: 7, duration: .12, ease: 'power2.out', stagger: .02 }, 1.38)
    .to(digits, { y: 0, duration: .9, ease: 'elastic.out(1, .4)', stagger: .02 }, 1.5)
    .to(stamp, { scale: 1.03, rotate: -12, x: 0, y: 0, xPercent: -50, yPercent: -50, duration: .8, ease: 'elastic.out(1, .45)' }, 1.4)
    /* the record fills in */
    .to(rows, { opacity: 1, x: 0, duration: .6, ease: 'expo.out', stagger: .1 }, 1.5);

  if (!p) return;
  /* The reviewer arrives, sizes up the record, and thumps its stamp in the same beat the mark lands. */
  gsap.set(p.root, { y: 70, scale: .82, opacity: 0, transformOrigin: '50% 100%' });
  gsap.set(p.shadow, { scaleX: .5, opacity: 0 });
  gsap.set(p.arm, { y: -30, rotate: -14 });
  gsap.set(p.mouth, { attr: { d: PURSED } });
  tl
    /* pops up from the floor while the digits drop from above */
    .to(p.root, { y: 0, scale: 1, opacity: 1, duration: 1.2, ease: 'elastic.out(1, .62)' }, .3)
    .to(p.shadow, { scaleX: 1, opacity: .08, duration: .7, ease: 'power2.out' }, .45)
    /* eyes the record, puzzled */
    .to(p.pupils, { x: 3, y: -2.5, duration: .4, ease: 'power2.out' }, .35)
    .fromTo(p.mark, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(2.6)' }, .5)
    .to(p.head, { rotate: 5, duration: .5, ease: 'power2.inOut' }, .6)
    /* then squints: decision made */
    .to(p.eyes, { scaleY: .55, duration: .3, ease: 'power2.inOut' }, .72)
    .to(p.mark, { scale: .5, opacity: 0, duration: .14, ease: 'power2.in' }, .88)
    /* winds up… */
    .to(p.arm, { y: -46, rotate: -20, duration: .16, ease: 'power2.out' }, .78)
    .to(p.flipper, { rotate: -14, duration: .16, ease: 'power2.out' }, .78)
    /* …and thumps, landing exactly with the mark at 1.40 */
    .to(p.arm, { y: 28, rotate: 4, duration: .45, ease: 'power4.in' }, .95)
    .to(p.flipper, { rotate: 6, duration: .45, ease: 'power4.in' }, .95)
    .to(p.pupils, { x: 2, y: 3, duration: .3, ease: 'power2.in' }, 1.1)
    /* impact: everything squashes for a frame */
    .to(p.body, { scaleY: .93, scaleX: 1.05, duration: .1, ease: 'power2.out' }, 1.4)
    .to(p.head, { rotate: -3, duration: .1, ease: 'power2.out' }, 1.4)
    .to(p.eyes, { scaleY: 1.16, scaleX: 1.08, duration: .1, ease: 'power2.out' }, 1.4)
    .to(p.whiskers, { scaleX: 1.08, duration: .08, ease: 'power2.out' }, 1.4)
    .to(p.shadow, { scaleX: 1.06, duration: .1, ease: 'power2.out' }, 1.4)
    /* and springs back */
    .to(p.body, { scaleY: 1, scaleX: 1, duration: .8, ease: 'elastic.out(1, .4)' }, 1.5)
    .to(p.head, { rotate: 0, duration: .8, ease: 'elastic.out(1, .45)' }, 1.5)
    .to(p.eyes, { scaleY: 1, scaleX: 1, duration: .6, ease: 'elastic.out(1, .5)' }, 1.5)
    .to(p.whiskers, { scaleX: 1, duration: .6, ease: 'elastic.out(1, .4)' }, 1.48)
    .to(p.shadow, { scaleX: 1, duration: .5, ease: 'power2.out' }, 1.5)
    .to(p.arm, { y: 0, rotate: 0, duration: .9, ease: 'elastic.out(1, .45)' }, 1.52)
    .to(p.flipper, { rotate: 0, duration: .8, ease: 'elastic.out(1, .45)' }, 1.52)
    /* looks at you, pleased with itself */
    .to(p.pupils, { x: 0, y: 0, duration: .45, ease: 'power2.inOut' }, 1.7)
    .to(p.mouth, { attr: { d: SMILE }, duration: .5, ease: 'back.out(1.7)' }, 1.75)
    .add(blink(p, true), 2.15)
    .add(() => idle(p), 2.6);
}

boot(build, hero);
