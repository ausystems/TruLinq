import '../../styles/main.css';
import '../../styles/pages/notfound.css';
import { boot, gsap, reduced } from '../main.js';
import { href } from '../ui.js';

function build() {
  document.querySelector('[data-nf-search]').addEventListener('submit', (e) => { e.preventDefault(); const q = document.querySelector('#nf-q').value.trim(); location.href = href('/directory/') + (q ? '?q=' + encodeURIComponent(q) : ''); });
}
function hero() {
  const input = document.querySelector('#nf-q');
  if (reduced) { input.focus({ preventScroll: true }); return; }
  gsap.timeline({ onComplete: () => input.focus({ preventScroll: true }) })
    .from('[data-digit]', { y: -80, opacity: 0, duration: 1.1, ease: 'elastic.out(1, .55)', stagger: .12 }, .1)
    .from('[data-mascot]', { y: 80, opacity: 0, duration: 1.2, ease: 'expo.out' }, .4);
}
boot(build, hero);
