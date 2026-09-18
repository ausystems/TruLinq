/* Builds the site for GitHub Pages (served under /TruLinq/) and publishes dist/ to the gh-pages branch. */
import { execSync } from 'node:child_process';
import { rmSync, existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', cwd: root, ...opts });
const remote = execSync('git remote get-url origin', { cwd: root }).toString().trim();
const base = process.env.BASE_PATH || '/TruLinq/';

run('npm run build', { env: { ...process.env, BASE_PATH: base } });
const dist = join(root, 'dist');
writeFileSync(join(dist, '.nojekyll'), '');
if (existsSync(join(dist, '.git'))) rmSync(join(dist, '.git'), { recursive: true, force: true });
run('git init -q -b gh-pages', { cwd: dist });
run('git add -A', { cwd: dist });
run('git -c user.name="trulinq-deploy" -c user.email="ausystems.io@gmail.com" commit -q -m "Deploy site"', { cwd: dist });
run(`git push -f "${remote}" gh-pages:gh-pages`, { cwd: dist });
rmSync(join(dist, '.git'), { recursive: true, force: true });
console.log('Published dist/ to gh-pages. Base path:', base);
