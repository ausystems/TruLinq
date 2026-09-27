/* Forward-only SQL migrations, each applied once inside a transaction and recorded with its checksum. Safe to run on
   every cold start: nothing pending means one cheap read. Production runs take a Postgres advisory lock so two
   instances never race. */
import { createHash } from 'node:crypto';
import type { Db, Queryable } from './client.ts';
import { MIGRATIONS } from './migrations/index.ts';

const LOCK_KEY = 7272_0001;

export interface MigrationStatus { applied: string[]; pending: string[] }

async function ensureTable(q: Queryable): Promise<void> {
  await q.query(`create table if not exists schema_migrations (
    name text primary key,
    checksum text not null,
    applied_at timestamptz not null default now()
  )`);
}

export async function migrationStatus(db: Db): Promise<MigrationStatus> {
  await ensureTable(db);
  const { rows } = await db.query<{ name: string; checksum: string }>('select name, checksum from schema_migrations order by name');
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));
  for (const m of MIGRATIONS) {
    const sum = applied.get(m.name);
    if (sum && sum !== checksum(m.sql)) throw new Error(`Migration ${m.name} was edited after it was applied (checksum mismatch). Add a new migration instead.`);
  }
  return { applied: [...applied.keys()], pending: MIGRATIONS.filter((m) => !applied.has(m.name)).map((m) => m.name) };
}

function checksum(sql: string): string { return createHash('sha256').update(sql).digest('hex'); }

export async function migrate(db: Db, log: (msg: string) => void = () => {}): Promise<string[]> {
  const status = await migrationStatus(db);
  if (!status.pending.length) return [];
  const ran: string[] = [];
  await db.transaction(async (tx) => {
    if (db.kind === 'pg') await tx.query('select pg_advisory_xact_lock($1)', [LOCK_KEY]);
    const { rows } = await tx.query<{ name: string }>('select name from schema_migrations');
    const done = new Set(rows.map((r) => r.name));
    for (const m of MIGRATIONS) {
      if (done.has(m.name)) continue;
      log(`applying ${m.name}`);
      await tx.exec(m.sql);
      await tx.query('insert into schema_migrations (name, checksum) values ($1, $2)', [m.name, checksum(m.sql)]);
      ran.push(m.name);
    }
  });
  return ran;
}

/** Cached per process so the request path pays for the check once. */
const g = globalThis as unknown as { __trulinqMigrated?: Promise<void> };
export function ensureMigrated(db: Db): Promise<void> {
  if (!g.__trulinqMigrated) g.__trulinqMigrated = migrate(db, (m) => console.info('[db]', m)).then(() => undefined).catch((e) => { delete g.__trulinqMigrated; throw e; });
  return g.__trulinqMigrated;
}
export function resetMigrationCache(): void { delete g.__trulinqMigrated; }
