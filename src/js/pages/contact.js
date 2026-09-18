import '../../styles/main.css';
import '../../styles/pages/contact.css';
import { boot, gsap, reduced, stamp, toast } from '../main.js';

const TO = { support: 'support@trulinq.com', fraud: 'trust@trulinq.com', privacy: 'privacy@trulinq.com', enterprise: 'sales@trulinq.com' };
const channels = [...document.querySelectorAll('[data-topic]')];
const select = document.querySelector('[data-topic-select]');
const toLine = document.querySelector('[data-to-line]');

function setTopic(t) {
  if (!TO[t]) t = 'support';
  channels.forEach((c) => c.setAttribute('aria-checked', String(c.dataset.topic === t)));
  select.value = t; toLine.textContent = TO[t];
}

function build() {
  const params = new URLSearchParams(location.search);
  let t = params.get('topic') || 'support';
  if (t === 'invite') { t = 'support'; document.querySelector('#c-msg').value = 'I’d like an invitation code.'; }
  setTopic(t);
  document.querySelector('[data-channels]').addEventListener('click', (e) => { const c = e.target.closest('[data-topic]'); if (!c) return; setTopic(c.dataset.topic); if (!reduced) gsap.fromTo(c, { scale: .985 }, { scale: 1, duration: .5, ease: 'back.out(2)', clearProps: 'transform' }); });
  document.querySelector('[data-channels]').addEventListener('keydown', (e) => {
    const i = channels.findIndex((c) => c.getAttribute('aria-checked') === 'true');
    if (['ArrowRight', 'ArrowDown'].includes(e.key)) { e.preventDefault(); const n = channels[(i + 1) % channels.length]; setTopic(n.dataset.topic); n.focus(); }
    if (['ArrowLeft', 'ArrowUp'].includes(e.key)) { e.preventDefault(); const n = channels[(i - 1 + channels.length) % channels.length]; setTopic(n.dataset.topic); n.focus(); }
  });
  select.addEventListener('change', () => setTopic(select.value));
  const member = document.querySelector('[data-member]'), profile = document.querySelector('[data-profile]');
  member.addEventListener('change', () => { profile.hidden = !member.checked; if (member.checked) profile.querySelector('input').focus(); });

  const form = document.querySelector('[data-letter]');
  const sealed = form.querySelector('[data-sealed]');
  const inv = (id, bad) => form.querySelector(id).closest('.field').classList.toggle('is-invalid', bad);
  form.querySelectorAll('input, textarea').forEach((el) => el.addEventListener('input', () => el.closest('.field') && el.closest('.field').classList.remove('is-invalid')));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('#c-name'), email = form.querySelector('#c-email'), msg = form.querySelector('#c-msg');
    const b1 = name.value.trim().length < 2, b2 = !email.validity.valid || !email.value, b3 = msg.value.trim().length < 8;
    inv('#c-name', b1); inv('#c-email', b2); inv('#c-msg', b3);
    if (b1) return name.focus(); if (b2) return email.focus(); if (b3) return msg.focus();
    const ref = 'TQ-CT-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    sealed.querySelector('[data-sealed-ledger]').innerHTML = [['To', TO[select.value]], ['From', email.value], ['Reference', ref], ['Expected reply', 'within one business day']].map(([k, v]) => `<li class="ledger__row"><span>${k}</span><i></i><b>${v}</b></li>`).join('');
    sealed.hidden = false;
    if (!reduced) gsap.from(sealed, { opacity: 0, scale: .98, duration: .6, ease: 'expo.out' });
    stamp(sealed.querySelector('.seal'), { delay: .3, rotate: -8 });
    toast('Sealed and sent. Reference ' + ref);
  });
  form.querySelector('[data-again]').addEventListener('click', () => { sealed.hidden = true; form.reset(); setTopic(select.value); profile.hidden = true; form.querySelector('#c-name').focus(); });
}

function hero() {
  if (reduced) return;
  gsap.from('.channel', { y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: '[data-channels]', start: 'top 85%', once: true }, clearProps: 'transform,opacity' });
  gsap.from('.letter', { y: 40, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.write', start: 'top 80%', once: true }, clearProps: 'transform,opacity' });
}

boot(build, hero);
