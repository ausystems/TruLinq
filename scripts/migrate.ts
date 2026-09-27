/* `npm run db:migrate`: applies pending migrations to DATABASE_URL (or the local PGlite store). Skips loudly when no
   database is configured in a production build, so a static deploy still succeeds. */
import { loadEnv } from '../server/env.ts';
import { getDb } from '../server/db/client.ts';
import { migrate, migrationStatus } from '../server/db/migrate.ts';

const env = loadEnv();
if (!env.DATABASE_URL && process.env['VERCEL']) {
  console.warn('[db:migrate] DATABASE_URL is not set on this deployment; the API will answer 503 database_unavailable until it is. Skipping migrations.');
  process.exit(0);
}
const db = await getDb(env);
const ran = await migrate(db, (m) => console.info('[db:migrate]', m));
const status = await migrationStatus(db);
console.info(`[db:migrate] ${ran.length} applied, ${status.applied.length} total, ${status.pending.length} pending (${db.kind})`);
await db.close();
