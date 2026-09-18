/* Shared UI templates: seal, ID cards, pills, score helpers. Pure functions returning markup. */

export const RING = 'TRULINQ · VERIFIED · ENTREPRENEUR ·';
/* Site base path ('/' locally, '/TruLinq/' on GitHub Pages). Every JS-built internal link goes through href(). */
export const BASE = import.meta.env.BASE_URL || '/';
export const href = (path) => BASE + String(path).replace(/^\//, '');

export function sealSVG({ ring = RING, id = 'r' + Math.random().toString(36).slice(2, 7) } = {}) {
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <defs><path id="${id}" d="M50,50 m-37,0 a37,37 0 1,1 74,0 a37,37 0 1,1 -74,0"/></defs>
    <circle class="seal__disc" cx="50" cy="50" r="49"/>
    <circle cx="50" cy="50" r="45.5" fill="none" stroke="var(--seal-ring)" stroke-opacity=".35" stroke-width="1"/>
    <g class="seal__rot"><text class="seal__ring" font-size="9.4" letter-spacing="1.35" fill="var(--seal-ring)"><textPath href="#${id}" textLength="232" lengthAdjust="spacingAndGlyphs">${ring}</textPath></text></g>
    <path class="seal__check" d="M34 51 L45 62 L67 38" stroke-width="7.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

export function seal({ size = 'md', variant = '', stamp = true, cls = '', label = 'Trulinq Verified' } = {}) {
  return `<span class="seal seal--${size} ${variant ? 'seal--' + variant : ''} ${cls}" ${stamp ? 'data-stamp' : ''} role="img" aria-label="${label}">${sealSVG()}</span>`;
}

export const INDUSTRY = {
  'Consulting':           { emoji: '💼', tone: 'violet' },
  'Direct sales/service': { emoji: '🤝', tone: 'peach' },
  'Energy':               { emoji: '⚡', tone: 'mint' },
  'Marketing':            { emoji: '📣', tone: 'violet' },
  'Real Estate':          { emoji: '🏠', tone: 'peach' },
  'Restaurant':           { emoji: '🍽️', tone: 'mint' },
  'Technology':           { emoji: '💻', tone: 'violet' },
  'Logistics':            { emoji: '🚚', tone: 'peach' }
};

export function industryPill(name, extra = '') {
  const m = INDUSTRY[name] || { emoji: '•', tone: 'sand' };
  return `<span class="pill pill--${m.tone} pill--sm ${extra}"><span class="emoji" aria-hidden="true">${m.emoji}</span>${name}</span>`;
}

export const FACTORS = [
  { key: 'identity', label: 'Identity & business verification', max: 45, note: 'ID and business documents reviewed and approved' },
  { key: 'profile',  label: 'Profile completeness',              max: 20, note: 'Profile details provided' },
  { key: 'web',      label: 'Web presence',                      max: 15, note: 'Secure business website linked' },
  { key: 'history',  label: 'Account history',                   max: 10, note: 'Time on Trulinq' },
  { key: 'standing', label: 'Standing since verification',       max: 10, note: 'Stamp held with no revocation' }
];

export function pointsOf(factors) { return factors.reduce((a, b) => a + b, 0); }
export function scoreOf(factors) { return Math.round(300 + 5.5 * pointsOf(factors)); }
export function gradeOf(score) {
  if (score >= 740) return { grade: 'AA', band: 'Excellent' };
  if (score >= 700) return { grade: 'A',  band: 'Very good' };
  if (score >= 580) return { grade: 'B',  band: 'Good' };
  if (score >= 480) return { grade: 'C',  band: 'Fair' };
  return { grade: 'D', band: 'Building' };
}
export function pct(score) { return Math.round(((score - 300) / 550) * 100); }

export function photo(id, w = 400, h = w) {
  return `https://images.unsplash.com/photo-${id}?w=${w}&h=${h}&fit=crop&crop=faces&q=80&auto=format`;
}

export function idCard(m, { tilt = null, href = true, stamp = true, cls = '' } = {}) {
  const hrefTo = (p) => BASE + p.replace(/^\//, '');
  const score = scoreOf(m.factors);
  const g = gradeOf(score);
  const tag = href ? 'a' : 'div';
  const link = href ? `href="${hrefTo(`/members/${m.id}/`)}"` : '';
  const style = tilt !== null ? `style="--tilt:${tilt}deg"` : '';
  return `<${tag} class="idcard ${tilt !== null ? 'idcard--tilt' : ''} ${cls}" ${link} ${style} data-member="${m.id}">
    <div class="idcard__photo">
      <img src="${photo(m.photo, 240)}" alt="${m.name}, ${m.role} at ${m.company}" width="96" height="96" loading="lazy" decoding="async">
      ${seal({ size: 'sm', stamp })}
    </div>
    <div class="idcard__body">
      <div class="idcard__name">${m.name}</div>
      <div class="idcard__role">${m.role} · ${m.company}</div>
      <div class="idcard__meta">${industryPill(m.industry)}<span class="pill pill--sand pill--sm">${m.city}</span></div>
      <div class="idcard__score">
        <div class="idcard__grade">${g.grade}<small>GRADE</small></div>
        <div>
          <div class="idcard__bar"><i style="--pct:${pct(score)}%" data-bar></i></div>
          <div class="idcard__band"><span>${g.band}</span><span class="mono">${score}</span></div>
        </div>
      </div>
    </div>
  </${tag}>`;
}

export function arrowIcon() {
  return `<span class="btn__icon" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8h9M8.5 4l4 4-4 4"/></svg></span>`;
}

export function fmtDate(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relTime(iso) {
  const d = new Date(iso); const now = new Date('2026-09-18T09:00:00');
  const h = Math.max(1, Math.round((now - d) / 36e5));
  if (h < 24) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso.slice(0, 10));
}

export const KIND_TONE = { Win: 'mint', Hiring: 'violet', Offer: 'peach', Update: 'sand', Ask: 'sky' };
export function postHTML(p, m) {
  return `<article class="post" data-post="${p.id}">
    <a href="${href(`/members/${m.id}/`)}"><img class="avatar" src="${photo(m.photo, 96)}" alt="" loading="lazy"></a>
    <div>
      <div class="post__head"><a class="post__who" href="${href(`/members/${m.id}/`)}">${m.name}<span class="seal seal--sm is-static" data-quiet aria-label="Verified">${sealSVG()}</span></a><span class="post__meta">${m.company} · ${relTime(p.at)}</span><span class="pill pill--sm pill--${KIND_TONE[p.kind] || 'sand'} post__kind">${p.kind}</span></div>
      <p class="post__text">${p.text}</p>
      <div class="post__foot"><span><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.2-4.2A8 8 0 1 1 21 12z"/></svg>${p.replies} repl${p.replies === 1 ? 'y' : 'ies'}</span><span><svg viewBox="0 0 24 24"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 4v12M8 8l4-4 4 4"/></svg>Share</span></div>
    </div>
  </article>`;
}
