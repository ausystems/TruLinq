/* One query interface, two engines: node-postgres against DATABASE_URL in production, an embedded PGlite (real
   Postgres compiled to WASM) for local development and tests. Both speak the same SQL, so migrations, constraints
   and transactions behave identically everywhere. */
import type { Env } from '../env.ts';

export interface QueryResult<T> { rows: T[]; rowCount: number }
export interface Queryable {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
  /** runs a multi-statement script (migrations); no parameters, no result */
  exec(script: string): Promise<void>;
}
export interface Db extends Queryable {
  kind: 'pg' | 'pglite';
  transaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

/** Postgres error code for unique violations, used by the retry paths. */
export const UNIQUE_VIOLATION = '23505';
export function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION;
}

async function createPg(url: string): Promise<Db> {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10000, connectionTimeoutMillis: 8000, ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false } });
  const run = async <T>(q: { query: (t: string, p?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }> }, text: string, params?: unknown[]): Promise<QueryResult<T>> => {
    const r = await q.query(text, params);
    return { rows: r.rows, rowCount: r.rowCount ?? r.rows.length };
  };
  return {
    kind: 'pg',
    query: (text, params) => run(pool, text, params),
    exec: async (script) => { await pool.query(script); },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const out = await fn({ query: (t, p) => run(client, t, p), exec: async (script) => { await client.query(script); } });
        await client.query('commit');
        return out;
      } catch (e) {
        try { await client.query('rollback'); } catch { /* connection already broken */ }
        throw e;
      } finally { client.release(); }
    },
    close: () => pool.end()
  };
}

async function createPglite(dir: string | undefined): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  if (dir) { const { mkdirSync } = await import('node:fs'); mkdirSync(dir, { recursive: true }); }
  const lite = dir ? new PGlite(dir) : new PGlite();
  await lite.waitReady;
  type Tx = { query: <T>(t: string, p?: unknown[]) => Promise<{ rows: T[]; affectedRows?: number }>; exec: (s: string) => Promise<unknown> };
  const run = async <T>(q: Tx, text: string, params?: unknown[]): Promise<QueryResult<T>> => {
    const r = await q.query<T>(text, params);
    /* PGlite reports 0 affected rows for SELECT; count returned rows first so existence checks work */
    return { rows: r.rows, rowCount: r.rows.length > 0 ? r.rows.length : (r.affectedRows ?? 0) };
  };
  return {
    kind: 'pglite',
    query: (text, params) => run(lite as unknown as Tx, text, params),
    exec: async (script) => { await lite.exec(script); },
    transaction: (fn) => lite.transaction((tx) => fn({ query: (t, p) => run(tx as unknown as Tx, t, p), exec: async (s) => { await (tx as unknown as Tx).exec(s); } })),
    close: () => lite.close()
  };
}

/** Serverless functions are reused across invocations; keep one client per process. */
const g = globalThis as unknown as { __trulinqDb?: Promise<Db> };
export function getDb(env: Env, opts: { memory?: boolean } = {}): Promise<Db> {
  if (opts.memory) return createPglite(undefined);
  if (!g.__trulinqDb) g.__trulinqDb = env.DATABASE_URL ? createPg(env.DATABASE_URL) : createPglite(env.PGLITE_DIR);
  return g.__trulinqDb;
}
export function resetDbCache(): void { delete g.__trulinqDb; }
