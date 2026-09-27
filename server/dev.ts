/* Local API server for `npm run dev` (Vite proxies /api here). Uses the embedded PGlite in .data/ unless DATABASE_URL
   is set. Loads .env from the project root without any extra dependency. */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { loadEnv } from './env.ts';
import { getDb } from './db/client.ts';
import { migrate } from './db/migrate.ts';
import { handleRequest } from './index.ts';
import type { ApiRequest } from './http.ts';

if (existsSync('.env')) for (const line of readFileSync('.env', 'utf8').split('\n')) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^"(.*)"$/, '$1');
}
const env = loadEnv();
const port = Number(process.env['API_PORT'] || 5190);
const db = await getDb(env);
const ran = await migrate(db, (m) => console.info('[db]', m));
console.info(`[api] ${db.kind}${env.DATABASE_URL ? '' : ' at ' + env.PGLITE_DIR}, ${ran.length ? ran.length + ' migrations applied' : 'schema up to date'}`);

const MAX_BODY = 9 * 1024 * 1024;
createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://localhost');
  if (!url.pathname.startsWith('/api/') && url.pathname !== '/api') { res.writeHead(404); res.end('not found'); return; }
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of req) { size += (chunk as Buffer).length; if (size > MAX_BODY) { res.writeHead(413); res.end(); return; } chunks.push(chunk as Buffer); }
  const raw = Buffer.concat(chunks);
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers[k.toLowerCase()] = v; else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(', ');
  const type = (headers['content-type'] || '').split(';')[0]!.trim();
  let body: unknown;
  if (raw.length && type === 'application/json') { try { body = JSON.parse(raw.toString('utf8')); } catch { body = undefined; } }
  const apiReq: ApiRequest = { method: (req.method || 'GET').toUpperCase(), path: url.pathname.replace(/^\/api/, '') || '/', query: url.searchParams, headers, body, rawBody: raw.length ? raw : undefined, ip: req.socket.remoteAddress || '0.0.0.0' };
  const out = await handleRequest(apiReq, { env, db });
  for (const [k, v] of Object.entries(out.headers)) res.setHeader(k, v);
  res.statusCode = out.status;
  res.end(out.body === null || out.body === undefined ? undefined : Buffer.isBuffer(out.body) ? out.body : JSON.stringify(out.body));
}).listen(port, () => console.info(`[api] listening on http://localhost:${port}`));
