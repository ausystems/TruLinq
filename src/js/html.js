/* Markup that is the same in the browser and in the build. Nothing here touches the document or Vite, so the build
   (vite.config.js, scripts/gen-members.mjs) can write it into the static HTML that search engines and readers without
   JavaScript receive, and the pages can write the same thing again from live data. */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
/* "Storage and security" → "storage-and-security", for anchors */
export const slugOf = (h) => String(h).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function fmtDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '';
  const d = new Date(String(iso).length <= 10 ? iso + 'T12:00:00' : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', opts);
}
export const addMonths = (iso, n) => { const d = new Date(String(iso).slice(0, 10) + 'T12:00:00'); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };

/* ── A member's profile: what they wrote, and the record beside it ── */
export function memberAboutHTML(m) {
  const needs = [['Offers', m.offers], ['Looking for', m.looking]].filter(([, v]) => v);
  return (m.bio ? `<p>${esc(m.bio)}</p>` : `<p class="is-empty">${esc(m.first || m.name)} hasn’t written a bio yet.</p>`)
    + (needs.length ? `<dl class="mhero__needs">${needs.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : '');
}
export function memberDetails(m, { verified = true, reverifyMonths = 12 } = {}) {
  return [
    ['Industry', m.industry], ['Location', [m.city, m.region, m.country].filter(Boolean).join(', ')], ['Founded', m.founded],
    ['Member since', fmtDate(m.joined)],
    ['Re-verification due', verified && m.verifiedOn ? fmtDate(addMonths(m.verifiedOn, reverifyMonths)) : '']
  ].filter(([, v]) => v).map(([k, v]) => [k, String(v)]);
}
export const ledgerHTML = (rows) => rows.map(([k, v]) => `<li class="ledger__row"><span>${esc(k)}</span><i></i><b>${esc(v)}</b></li>`).join('');

/* ── The legal pages: the index and the clauses, each with its plain-language summary ── */
export const legalIndexHTML = (doc) => doc.sections.map((s) => `<li><a href="#${slugOf(s.h)}">${esc(s.h)}</a></li>`).join('');
export function legalClausesHTML(doc) {
  const linkEmail = (text) => esc(text).replace(esc(doc.email), `<a class="link" href="mailto:${esc(doc.email)}">${esc(doc.email)}</a>`);
  return doc.sections.map((s) => `<article class="clause" id="${slugOf(s.h)}" aria-labelledby="${slugOf(s.h)}-title">
    <h2 id="${slugOf(s.h)}-title" class="display">${esc(s.h)}</h2>
    <p class="clause__body">${linkEmail(s.body)}</p>
    <div class="clause__short"><b>In short</b><p>${esc(s.short)}</p></div>
  </article>`).join('\n');
}
