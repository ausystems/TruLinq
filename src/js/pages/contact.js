import '../../styles/main.css';
import '../../styles/pages/contact.css';
import { boot, stamp, busy, setInvalid, clearOnEdit } from '../main.js';
import { api, ApiError } from '../api.js';
import { SITE } from '../../data/site.js';

const TO = { support: SITE.email.support, fraud: SITE.email.trust, privacy: SITE.email.privacy, enterprise: SITE.email.sales };
const $ = (s) => document.querySelector(s);
const channels = [...document.querySelectorAll('[data-topic]')];
const select = $('[data-topic-select]');

/* One topic is chosen at a time; the channel cards and the select stay in step. */
function setTopic(t, focus = false) {
  if (!TO[t]) t = 'support';
  channels.forEach((c) => { const on = c.dataset.topic === t; c.setAttribute('aria-checked', String(on)); c.tabIndex = on ? 0 : -1; if (on && focus) c.focus(); });
  select.value = t;
  $('[data-to-line]').textContent = TO[t];
}

/* Arriving from Request an invitation: the page says so in its first line, the form follows the heading directly, and
   the message is started for them, ending where they carry on in their own words. */
function invite() {
  $('#contact-title').textContent = 'Request an invitation.';
  $('.chero .lead').textContent = 'Tell us who you are and what your business does. A person reads every request, and most replies land within one business day.';
  $('.channels').hidden = true;
  $('#write-title').textContent = 'Your request';
  $('#c-msg').value = 'I’d like an invitation code. My business is ';
  $('[data-letter] button[type=submit] span').textContent = 'Send request';
  $('[data-member]').closest('.switch').hidden = true;
  /* the closing call would only lead back here */
  const close = $('.cta'); if (close) close.hidden = true;
  document.title = 'Request an invitation · Trulinq';
}

function build() {
  const params = new URLSearchParams(location.search);
  let t = params.get('topic') || 'support';
  if (t === 'invite') { t = 'support'; invite(); }
  setTopic(t);
  $('[data-channels]').addEventListener('click', (e) => { const c = e.target.closest('[data-topic]'); if (c) setTopic(c.dataset.topic); });
  $('[data-channels]').addEventListener('keydown', (e) => {
    const i = channels.findIndex((c) => c.getAttribute('aria-checked') === 'true');
    const step = ['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(e.key) ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    setTopic(channels[(i + step + channels.length) % channels.length].dataset.topic, true);
  });
  select.addEventListener('change', () => setTopic(select.value));

  const member = $('[data-member]'), profileField = $('[data-profile]'), profile = $('#c-profile');
  member.addEventListener('change', () => { profileField.hidden = !member.checked; if (member.checked) profile.focus(); });

  const form = $('[data-letter]'), sealed = $('[data-sealed]'), error = $('[data-letter-error]');
  const name = $('#c-name'), email = $('#c-email'), msg = $('#c-msg');
  const submit = form.querySelector('button[type=submit]'), copy = form.querySelector('[name=copy]');
  clearOnEdit(form);
  form.addEventListener('input', () => { error.hidden = true; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b1 = name.value.trim().length < 2, b2 = !email.value.trim() || !email.validity.valid, b3 = msg.value.trim().length < 8;
    setInvalid(name, b1); setInvalid(email, b2); setInvalid(msg, b3);
    if (b1) return name.focus();
    if (b2) return email.focus();
    if (b3) return msg.focus();
    busy(submit, true);
    let r;
    try {
      r = await api.post('/contact', { topic: select.value, name: name.value.trim(), email: email.value.trim(), message: msg.value.trim(), profile: member.checked ? (profile.value.trim() || undefined) : undefined, copy: copy.checked });
    } catch (err) {
      /* the letter stays exactly as written */
      error.textContent = err instanceof ApiError && err.status !== 0 && err.status !== 503
        ? err.message
        : `Your message couldn’t be sent right now. It’s still here, so you can try again, or email ${TO[select.value]} directly.`;
      error.hidden = false;
      return;
    } finally { busy(submit, false); }
    const rows = [
      ['To', r.to], ['From', email.value.trim()], ['Reference', r.reference],
      ['Delivery', r.delivered ? 'Delivered to the team' : 'Saved for the team; email delivery isn’t connected yet'],
      ['Your copy', copy.checked ? (r.delivered ? 'Sent to you' : 'Not sent; email isn’t connected yet') : 'Not requested']
    ];
    const ledger = sealed.querySelector('[data-sealed-ledger]');
    ledger.innerHTML = rows.map(() => '<li class="ledger__row"><span></span><i></i><b></b></li>').join('');
    ledger.querySelectorAll('.ledger__row').forEach((li, i) => { li.querySelector('span').textContent = rows[i][0]; li.querySelector('b').textContent = rows[i][1]; });
    form.hidden = true; sealed.hidden = false; sealed.focus();
    stamp(sealed.querySelector('.seal'), { delay: .2, rotate: -8 });
  });
  $('[data-again]').addEventListener('click', () => {
    sealed.hidden = true; form.hidden = false;
    msg.value = ''; profileField.hidden = !member.checked;
    sealed.querySelector('.seal').classList.remove('is-stamped');
    msg.focus();
  });
}

boot(build);
