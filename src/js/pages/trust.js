import '../../styles/main.css';
import '../../styles/pages/trust.css';
import { boot, stamp, busy, setInvalid, clearOnEdit } from '../main.js';
import { api, ApiError } from '../api.js';
import { SITE } from '../../data/site.js';

function report() {
  const form = document.querySelector('[data-report]');
  const done = document.querySelector('[data-report-done]');
  const error = form.querySelector('[data-report-error]');
  const link = form.querySelector('#r-link'), what = form.querySelector('#r-what'), mail = form.querySelector('#r-email');
  const submit = form.querySelector('button[type=submit]');
  clearOnEdit(form);
  form.addEventListener('input', () => { error.hidden = true; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const badLink = !/^(https?:\/\/)?[^\s/]+\.[^\s]+/.test(link.value.trim());
    const badWhat = what.value.trim().length < 12;
    const badMail = !mail.value.trim() || !mail.validity.valid;
    setInvalid(link, badLink); setInvalid(what, badWhat); setInvalid(mail, badMail);
    if (badLink) return link.focus();
    if (badWhat) return what.focus();
    if (badMail) return mail.focus();
    busy(submit, true);
    try {
      const r = await api.post('/reports', { link: link.value.trim(), details: what.value.trim(), email: mail.value.trim() });
      done.querySelector('[data-report-ledger]').innerHTML = [['Reference', r.reference], ['Follow-up to', mail.value.trim()]]
        .map(([k, v]) => `<li class="ledger__row"><span>${k}</span><i></i><b></b></li>`).join('');
      done.querySelectorAll('[data-report-ledger] b').forEach((b, i) => { b.textContent = i ? mail.value.trim() : r.reference; });
      form.hidden = true; done.hidden = false; done.focus();
      stamp(done.querySelector('.seal'), { delay: .15, rotate: -8 });
    } catch (err) {
      /* the report stays in the form; nothing typed is lost */
      error.textContent = err instanceof ApiError && err.status !== 0 && err.status !== 503
        ? err.message
        : `The report couldn’t be sent right now. Your text is still here. You can also email ${SITE.email.trust}.`;
      error.hidden = false;
    } finally { busy(submit, false); }
  });
}

boot(async () => { report(); });
