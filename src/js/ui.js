/* Shared templates: the seal, portraits, the member card, posts, and the small formatting rules everything uses.
   Everything a member wrote is escaped before it touches markup. */

export const RING = 'TRULINQ · VERIFIED · ENTREPRENEUR ·';
/* Site base path ('/' locally, '/TruLinq/' on GitHub Pages). Every JS-built internal link goes through href(). */
export const BASE = import.meta.env.BASE_URL || '/';
export const href = (path) => BASE + String(path).replace(/^\//, '');

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

/* ── The seal ──────────────────────────────────────────────────── */
/* Full: the navy face, the sky-to-royal rim, the turning ring text and the TD mark. Compact (under 56px): no ring
   text, a heavier rim and a larger mark, so the seal stays crisp at avatar size. Gradients and the mark symbol are
   defined once in partials/nav.html. */
let sealN = 0;
export function sealSVG({ compact = false, ring = RING } = {}) {
  if (compact) {
    return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle class="seal__disc" cx="50" cy="50" r="48"/>
      <circle cx="50" cy="50" r="44.5" fill="none" stroke="url(#tq-seal-rim)" stroke-width="7"/>
      <use class="seal__mark" href="#tq-mark" x="24" y="24" width="52" height="52"/>
    </svg>`;
  }
  const id = `seal-ring-${++sealN}`;
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <defs><path id="${id}" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0"/></defs>
    <circle class="seal__disc" cx="50" cy="50" r="48"/>
    <circle cx="50" cy="50" r="46.5" fill="none" stroke="url(#tq-seal-rim)" stroke-width="3"/>
    <g><text class="seal__ring" font-size="9.4" letter-spacing="1.35" fill="var(--seal-ring)"><textPath href="#${id}" textLength="232" lengthAdjust="spacingAndGlyphs">${ring}</textPath></text></g>
    <circle cx="50" cy="50" r="28.5" fill="none" stroke="var(--seal-ring)" stroke-opacity=".4" stroke-width="1"/>
    <use class="seal__mark" href="#tq-mark" x="32" y="32" width="36" height="36"/>
  </svg>`;
}
export function seal({ size = 'md', cls = '', label = 'Trulinq Verified', manual = false } = {}) {
  const compact = size === 'sm' || size === 'xs';
  return `<span class="seal seal--${size} ${cls}" ${manual ? 'data-manual' : ''} role="img" aria-label="${esc(label)}">${sealSVG({ compact })}</span>`;
}

/* ── Portraits ─────────────────────────────────────────────────── */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter((w) => /^[\p{L}]/u.test(w) && !/^(jr|sr|ii|iii)\.?$/i.test(w));
  return ((parts[0] || 'T')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
/* Four tones, fixed per member, so a directory of monograms reads as a set of individuals. */
export function toneOf(key) {
  let h = 0; for (const c of String(key || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 4;
}
const PORTRAIT_SIZES = [96, 240, 480, 960];
export function photoSrc(photo, w) {
  if (/^(https?:|data:)/.test(photo)) return photo;
  const size = PORTRAIT_SIZES.find((s) => s >= w) || 960;
  return href(`${photo}-${size}.webp`);
}
/* A member's portrait: their photo when one is published, otherwise a monogram in one of the four tones. */
export function portrait(m, { size = 96, cls = '', decorative = true } = {}) {
  const label = decorative ? 'aria-hidden="true"' : `role="img" aria-label="${esc(m.name)}"`;
  /* a placeholder belongs to no one: a neutral figure, never initials that could read as a real person's */
  if (m.placeholder) return `<span class="portrait portrait--sample ${cls}" aria-hidden="true"><span class="silhouette"></span></span>`;
  if (m.photo) {
    const src2 = photoSrc(m.photo, size * 2);
    return `<img class="portrait ${cls}" src="${photoSrc(m.photo, size)}" srcset="${photoSrc(m.photo, size)} 1x, ${src2} 2x" width="${size}" height="${size}" alt="${decorative ? '' : esc(m.name)}" loading="lazy" decoding="async" data-fade>`;
  }
  return `<span class="portrait portrait--mono ${cls}" data-tone="${toneOf(m.id || m.name)}" ${label}><span>${esc(initials(m.name))}</span></span>`;
}

/* ── Status, score and the lines a member card shows ───────────── */
export function statusOf(m) {
  const s = m.status || 'verified';
  return { verified: { key: 'verified', label: 'Trulinq Verified' }, pending: { key: 'pending', label: 'In review' }, revoked: { key: 'revoked', label: 'Stamp revoked' } }[s] || { key: 'unverified', label: 'Not verified' };
}
export const isVerified = (m) => (m.status || 'verified') === 'verified';

export const FACTORS = [
  { key: 'identity', label: 'Identity & business verification', max: 45 },
  { key: 'profile', label: 'Profile completeness', max: 20 },
  { key: 'web', label: 'Web presence', max: 15 },
  { key: 'history', label: 'Account history', max: 10 },
  { key: 'standing', label: 'Standing since verification', max: 10 }
];
export function pointsOf(factors) { return factors.reduce((a, b) => a + b, 0); }
export function scoreOf(factors) { return Math.round(300 + 5.5 * pointsOf(factors)); }
/* Bands as the live product labels them. */
export function gradeOf(score) {
  if (score >= 740) return { grade: 'AA', band: 'Excellent' };
  if (score >= 700) return { grade: 'A', band: 'Good' };
  if (score >= 580) return { grade: 'B', band: 'Fair' };
  if (score >= 480) return { grade: 'C', band: 'Limited' };
  return { grade: 'D', band: 'Building' };
}
export function pct(score) { return Math.round(((score - 300) / 550) * 100); }

export const roleLine = (m) => [m.role, m.company].filter(Boolean).join(' · ') || m.headline || '';
export const placeLine = (m) => [m.city, m.region].filter(Boolean).join(', ') || m.country || '';
export const metaLine = (m) => [m.industry, m.city || m.country].filter(Boolean).join(' · ');

/* ── The member card ───────────────────────────────────────────── */
/* The card is the record in miniature: portrait with the stamp on it, name, role, where and what, and the score. */
export function idCard(m, { link = true, stamp = 'static', cls = '', sealSize = 'sm' } = {}) {
  const score = m.score ?? scoreOf(m.factors);
  const g = gradeOf(score);
  const tag = link ? 'a' : 'div';
  const attrs = link ? `href="${href(`/members/${m.id}/`)}" aria-label="${esc(m.name)}${roleLine(m) ? ', ' + esc(roleLine(m)) : ''}${isVerified(m) ? ', Trulinq Verified' : ''}"` : '';
  const sealHTML = isVerified(m) && stamp !== 'none' ? seal({ size: sealSize, manual: stamp === 'manual' }) : '';
  return `<${tag} class="idcard ${cls}" ${attrs} data-member="${esc(m.id)}">
    <span class="idcard__photo">${portrait(m, { size: 96 })}${sealHTML}</span>
    <span class="idcard__body">
      <span class="idcard__name">${esc(m.name)}</span>
      <span class="idcard__role">${esc(roleLine(m)) || '&nbsp;'}</span>
      <span class="idcard__meta">${[esc(metaLine(m)), isVerified(m) ? '' : statusOf(m).label].filter(Boolean).join(' · ') || statusOf(m).label}</span>
      <span class="idcard__score"><b class="idcard__grade">${g.grade}</b><span class="idcard__bar" aria-hidden="true"><i style="--pct:${pct(score)}%"></i></span><span class="idcard__num">${score}</span></span>
    </span>
  </${tag}>`;
}

/* ── Dates ─────────────────────────────────────────────────────── */
export function fmtDate(iso, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!iso) return '';
  const d = new Date(String(iso).length <= 10 ? iso + 'T12:00:00' : iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', opts);
}
export function relTime(iso) {
  const d = new Date(iso); const mins = Math.max(1, Math.round((Date.now() - d.getTime()) / 6e4));
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60); if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24); if (days < 7) return `${days} d ago`;
  return fmtDate(iso);
}
export function durationSince(iso, now = new Date()) {
  const days = Math.max(0, Math.floor((now - new Date(String(iso).slice(0, 10) + 'T12:00:00')) / 864e5));
  if (days < 1) return 'less than a day';
  if (days < 45) return `${days} day${days === 1 ? '' : 's'}`;
  const months = Math.round(days / 30.4375);
  return `${months} month${months === 1 ? '' : 's'}`;
}

/* ── Posts ─────────────────────────────────────────────────────── */
export function postHTML(p, author) {
  const a = author || p.author;
  return `<article class="post" data-post="${esc(p.id)}" data-kind="${esc(p.kind)}">
    <a class="post__avatar" href="${href(`/members/${a.id}/`)}" tabindex="-1" aria-hidden="true">${portrait(a, { size: 44 })}</a>
    <div class="post__main">
      <header class="post__head">
        <a class="post__who" href="${href(`/members/${a.id}/`)}">${esc(a.name)}</a>${isVerified(a) ? seal({ size: 'xs', label: 'Trulinq Verified' }) : ''}
        <span class="post__meta">${a.company ? esc(a.company) + ' · ' : ''}<time datetime="${esc(p.at)}">${relTime(p.at)}</time></span>
        <span class="tag post__kind">${esc(p.kind)}</span>
      </header>
      <p class="post__text">${esc(p.text)}</p>
    </div>
  </article>`;
}

export function arrowIcon() {
  return `<svg class="icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 4l4 4-4 4"/></svg>`;
}
