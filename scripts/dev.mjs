/* `npm run dev`: the API (tsx server/dev.ts, embedded Postgres) and Vite together, one Ctrl-C stops both. */
import { spawn } from 'node:child_process';
const opts = { stdio: 'inherit', shell: true, env: process.env };
const api = spawn('npx tsx server/dev.ts', opts);
const web = spawn('npx vite --port 5180 --strictPort', opts);
const stop = () => { api.kill('SIGINT'); web.kill('SIGINT'); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
web.on('exit', (code) => { api.kill('SIGINT'); process.exit(code ?? 0); });
api.on('exit', (code) => { if (code && code !== 0) { web.kill('SIGINT'); process.exit(code); } });
