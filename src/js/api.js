/* The browser's one door to the backend. Same-origin /api by default (Vercel), or VITE_API_BASE for static hosts.
   Every call carries the session cookie and the header the server requires for state changes. */
import { href } from './ui.js';

export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '') || href('/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details) { super(message || code); this.status = status; this.code = code; this.details = details || null; }
  /** the first field-level message the server sent, if any */
  field(path) { const issues = this.details && this.details.issues; if (!issues) return null; const hit = issues.find((i) => i.path === path); return hit ? hit.message : null; }
}

async function request(method, path, { body, raw, headers } = {}) {
  const init = { method, credentials: 'include', headers: { 'x-requested-with': 'fetch', ...(headers || {}) } };
  if (raw !== undefined) init.body = raw;
  else if (body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(API_BASE + path, init); }
  catch { throw new ApiError(0, 'network', 'The backend could not be reached.'); }
  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = null; } }
  if (!res.ok) {
    const e = (data && data.error) || {};
    throw new ApiError(res.status, e.code || 'error', e.message || `Request failed (${res.status}).`, e.details);
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, { body }),
  patch: (path, body) => request('PATCH', path, { body }),
  put: (path, raw, headers) => request('PUT', path, { raw, headers })
};

/** True when the API answered with a "database not configured" style failure, i.e. the deployment has no backend yet. */
export const isBackendUnavailable = (e) => e instanceof ApiError && (e.status === 0 || e.status === 503 || e.status === 404 && e.code === 'error');
