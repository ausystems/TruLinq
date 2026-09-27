/* Framework-agnostic HTTP primitives. Every route receives an ApiRequest and returns an ApiResponse; the Vercel
   function and the local dev server are thin adapters over these. */

export interface ApiRequest {
  method: string;
  /** path without the /api prefix, e.g. "/auth/login" */
  path: string;
  query: URLSearchParams;
  /** lower-cased header names */
  headers: Record<string, string>;
  /** parsed JSON body (objects only) or undefined */
  body: unknown;
  /** raw bytes for uploads */
  rawBody?: Buffer;
  ip: string;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string | string[]>;
  body: unknown;
}

export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string, public details?: unknown) {
    super(message || code);
  }
}

export const errors = {
  badRequest: (code = 'bad_request', message = 'The request is not valid.', details?: unknown) => new HttpError(400, code, message, details),
  unauthorized: (message = 'Sign in to continue.') => new HttpError(401, 'unauthorized', message),
  forbidden: (message = 'You are not allowed to do that.') => new HttpError(403, 'forbidden', message),
  notFound: (code = 'not_found', message = 'Not found.') => new HttpError(404, code, message),
  conflict: (code: string, message: string) => new HttpError(409, code, message),
  tooMany: (retryAfter: number) => new HttpError(429, 'rate_limited', 'Too many attempts. Try again shortly.', { retryAfter }),
  unavailable: (code: string, message: string) => new HttpError(503, code, message)
};

export function json(body: unknown, status = 200, headers: Record<string, string | string[]> = {}): ApiResponse {
  return { status, headers: { 'content-type': 'application/json; charset=utf-8', ...headers }, body };
}

export function noContent(headers: Record<string, string | string[]> = {}): ApiResponse {
  return { status: 204, headers, body: null };
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export interface CookieOptions { maxAge?: number; secure?: boolean; httpOnly?: boolean; sameSite?: 'Lax' | 'Strict' | 'None'; path?: string; expires?: Date }
export function serializeCookie(name: string, value: string, o: CookieOptions = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${o.path ?? '/'}`];
  if (o.maxAge !== undefined) parts.push(`Max-Age=${Math.floor(o.maxAge)}`);
  if (o.expires) parts.push(`Expires=${o.expires.toUTCString()}`);
  if (o.httpOnly !== false) parts.push('HttpOnly');
  if (o.secure) parts.push('Secure');
  parts.push(`SameSite=${o.sameSite ?? 'Lax'}`);
  return parts.join('; ');
}

/** Matches "/members/:slug" style patterns. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean), b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    const p = a[i]!, v = b[i]!;
    if (p.startsWith(':')) params[p.slice(1)] = decodeURIComponent(v);
    else if (p !== v) return null;
  }
  return params;
}
