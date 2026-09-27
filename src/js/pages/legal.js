import '../../styles/main.css';
import '../../styles/pages/legal.css';
import { boot } from '../main.js';
import { esc } from '../ui.js';

const slugOf = (h) => h.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function renderLegal(doc) {
  document.querySelector('[data-summary]').textContent = doc.summary;
  const linkEmail = (text) => esc(text).replace(esc(doc.email), `<a class="link" href="mailto:${esc(doc.email)}">${esc(doc.email)}</a>`);
  document.querySelector('[data-index]').innerHTML = doc.sections.map((s) => `<li><a href="#${slugOf(s.h)}">${esc(s.h)}</a></li>`).join('');
  document.querySelector('[data-clauses]').innerHTML = doc.sections.map((s) => `<article class="clause" id="${slugOf(s.h)}" aria-labelledby="${slugOf(s.h)}-title">
    <h2 id="${slugOf(s.h)}-title" class="display">${esc(s.h)}</h2>
    <p class="clause__body">${linkEmail(s.body)}</p>
    <div class="clause__short"><b>In short</b><p>${esc(s.short)}</p></div>
  </article>`).join('');
}

export function legalBoot(doc) { boot(async () => renderLegal(doc)); }
