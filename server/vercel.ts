/* Vercel Serverless Function: bundled by scripts/build-api.mjs into api/[[...path]].js, so every /api/* request lands
   here and is handed to the shared router. */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { loadEnv } from './env.ts';
import { getDb } from './db/client.ts';
import { handleRequest } from './index.ts';
import type { ApiRequest } from './http.ts';

type VercelRequest = IncomingMessage & { body?: unknown; query?: Record<string, string | string[]> };
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
  const apiReq: ApiRequest = { method: (req.method || 'GET').toUpperCase(), path: url.pathname.replace(/^\/api/, '') || '/', query: url.searchParams, headers, body, rawBody, ip: forwarded.split(',')[0]!.trim() };
  let out;
  try {
    const db = await getDb(env);
    out = await handleRequest(apiReq, { env, db });
  } catch (e) {
    /* no DATABASE_URL on this deployment (or the pool cannot be created): say so cleanly, never a crash page */
    console.error('[api] database unavailable:', e instanceof Error ? e.message : e);
    out = { status: 503, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: { error: { code: 'database_unavailable', message: 'The backend has no database configured yet.' } } };
  }
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  res.statusCode = out.status;
  res.end(out.body === null || out.body === undefined ? undefined : Buffer.isBuffer(out.body) ? out.body : JSON.stringify(out.body));
}
