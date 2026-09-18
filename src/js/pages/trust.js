import '../../styles/main.css';
import '../../styles/pages/trust.css';
import { boot, gsap, ScrollTrigger, reduced, stamp, toast } from '../main.js';

function diagram() {
  const lines = document.querySelectorAll('[data-line]');
  if (reduced) { gsap.set(lines, { strokeDashoffset: 0 }); return; }
  gsap.to(lines, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut', stagger: .12, scrollTrigger: { trigger: '[data-diagram]', start: 'top 70%', once: true } });
}

function matrix() {
  document.querySelectorAll('.matrix__row').forEach((row, i) => {
    ScrollTrigger.create({ trigger: row, start: 'top 92%', once: true, onEnter: () => setTimeout(() => row.classList.add('is-in'), i * 60) });
  });
}

function report() {
  const form = document.querySelector('[data-report]');
  const done = form.querySelector('[data-report-done]');
  const invalid = (id, bad) => form.querySelector(id).closest('.field').classList.toggle('is-invalid', bad);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const link = form.querySelector('#r-link'), what = form.querySelector('#r-what'), mail = form.querySelector('#r-email');
    const badLink = !/^(https?:\/\/)?[^\s]+\.[^\s]+/.test(link.value.trim()), badWhat = what.value.trim().length < 12, badMail = !mail.validity.valid || !mail.value;
    invalid('#r-link', badLink); invalid('#r-what', badWhat); invalid('#r-email', badMail);
    if (badLink) return link.focus(); if (badWhat) return what.focus(); if (badMail) return mail.focus();
    done.hidden = false;
    if (!reduced) gsap.from(done, { opacity: 0, duration: .5 });
    stamp(done.querySelector('.seal'), { delay: .2, rotate: -8 });
    toast('Report received. A reviewer will look today.');
  });
  form.querySelectorAll('.input').forEach((el) => el.addEventListener('input', () => el.closest('.field').classList.remove('is-invalid')));
}

boot(async () => { report(); }, () => { diagram(); matrix(); });
