/* Vercel Serverless Function: bundled by scripts/build-api.mjs into api/[[...path]].js, so every /api/* request lands
   here and is handed to the shared router. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv } from './env.ts';
import { getDb } from './db/client.ts';
import { handleRequest } from './index.ts';
import type { ApiRequest } from './http.ts';

type VercelRequest = IncomingMessage & { body?: unknown; query?: Record<string, string | string[]> };

/** Vercel rewrites /api/auth/login to /api/[[...path]]?path=auth/login; the real path lives in the query segment. */
function apiPath(req: VercelRequest, url: URL): string {
  const seg = req.query?.['path'] ?? url.searchParams.get('path');
  url.searchParams.delete('path');
  if (seg !== undefined && seg !== null && seg !== '') return '/' + (Array.isArray(seg) ? seg.join('/') : String(seg)).replace(/^\/+/, '');
  if (/\[\[\.\.\.path\]\]/.test(url.pathname)) return '/';
  return url.pathname.replace(/^\/api/, '') || '/';
}
const env = loadEnv();

export default async function handler(req: VercelRequest, res: ServerResponse): Promise<void> {
  const url = new URL(req.url || '/', 'http://localhost');
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k.toLowerCase()] = v; else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(', ');
  const type = (headers['content-type'] || '').split(';')[0]!.trim();
  let body: unknown; let rawBody: Buffer | undefined;
  const b = req.body;
  if (Buffer.isBuffer(b)) { rawBody = b; if (type === 'application/json') { try { body = JSON.parse(b.toString('utf8')); } catch { body = undefined; } } }
  else if (typeof b === 'string') { rawBody = Buffer.from(b); if (type === 'application/json') { try { body = JSON.parse(b); } catch { body = undefined; } } }
  else if (b && typeof b === 'object') body = b;
  const forwarded = headers['x-forwarded-for'] || headers['x-real-ip'] || req.socket?.remoteAddress || '0.0.0.0';
  const path = apiPath(req, url);
  const apiReq: ApiRequest = { method: (req.method || 'GET').toUpperCase(), path, query: url.searchParams, headers, body, rawBody, ip: forwarded.split(',')[0]!.trim() };
  /* the router opens the database only for a matched route; a missing DATABASE_URL becomes a clean 503 there */
  const out = await handleRequest(apiReq, { env, db: () => getDb(env) });
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  res.statusCode = out.status;
  res.end(out.body === null || out.body === undefined ? undefined : Buffer.isBuffer(out.body) ? out.body : JSON.stringify(out.body));
}
