import '../../styles/main.css';
import '../../styles/pages/notfound.css';
import { boot, gsap, reduced, go } from '../main.js';
import { mascotParts, prime, review } from '../mascot.js';
import { href, BASE } from '../ui.js';

function build() {
  const path = location.pathname.startsWith(BASE) ? '/' + location.pathname.slice(BASE.length) : location.pathname;
  document.querySelector('[data-nf-path]').textContent = path || '/';
  document.querySelector('[data-nf-time]').textContent = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  document.querySelector('[data-nf-search]').addEventListener('submit', (e) => { e.preventDefault(); const q = document.querySelector('#nf-q').value.trim(); go(href('/directory/') + (q ? '?q=' + encodeURIComponent(q) : ''), 'Directory'); });
}

function hero() {
  const input = document.querySelector('#nf-q');
  const digits = document.querySelectorAll('[data-digit]');
  const stamp = document.querySelector('[data-nf-stamp]');
  const rows = document.querySelectorAll('[data-nf-ledger] .ledger__row');
  if (reduced) { input.focus({ preventScroll: true }); return; }
  const p = mascotParts(document.querySelector('[data-nf-mascot]'));
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
  /* The reviewer arrives, sizes up the record, and thumps its stamp in the same beat the mark lands (1.4s). */
  prime(p);
  review(tl, p, { land: 1.4 });
}

boot(build, hero);
