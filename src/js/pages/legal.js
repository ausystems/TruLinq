import '../../styles/main.css';
import '../../styles/pages/legal.css';
import { boot, gsap, ScrollTrigger, reduced } from '../main.js';

export function renderLegal(doc) {
  document.querySelector('[data-summary]').textContent = doc.summary;
  const idx = document.querySelector('[data-index]');
  const list = document.querySelector('[data-clauses]');
  idx.innerHTML = doc.sections.map((s, i) => `<a href="#c${i + 1}" data-idx="${i}"><span>${String(i + 1).padStart(2, '0')}</span>${s.h}</a>`).join('');
  list.innerHTML = doc.sections.map((s, i) => `<article class="clause" id="c${i + 1}">
    <span class="clause__n">Clause ${String(i + 1).padStart(2, '0')}</span>
    <h2 class="display" data-split>${s.h}</h2>
    <p class="clause__body">${s.body.replace(/privacy@trulinq\.com/g, '<a href="mailto:privacy@trulinq.com">privacy@trulinq.com</a>')}</p>
    <div class="clause__short"><b>In short</b><p>${s.short}</p></div>
  </article>`).join('');
  document.querySelectorAll('[data-email]').forEach((el) => { el.textContent = doc.email; el.href = 'mailto:' + doc.email; });
}

export function trackIndex() {
  const links = [...document.querySelectorAll('[data-index] a')];
  document.querySelectorAll('.clause').forEach((c, i) => {
    ScrollTrigger.create({ trigger: c, start: 'top 40%', end: 'bottom 40%', onToggle: (s) => { if (s.isActive) links.forEach((l, j) => l.classList.toggle('is-active', i === j)); } });
  });
  links[0] && links[0].classList.add('is-active');
  if (!reduced) gsap.from('.clause__short', { opacity: 0, y: 12, duration: .8, ease: 'expo.out', stagger: .05, scrollTrigger: { trigger: '[data-clauses]', start: 'top 80%', once: true } });
}

export function legalBoot(doc) { boot(async () => renderLegal(doc), () => trackIndex()); }
