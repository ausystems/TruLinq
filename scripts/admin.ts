/* Operator commands (server-side only, needs DATABASE_URL or the local store):
     npm run admin -- create-user --email you@x.com --password 'long passphrase' [--member ahmad-khalid] [--name "Full Name"] [--admin]
     npm run admin -- set-code --member tyler-shirakawa --code E9EAF5     # keep a legacy referral code
     npm run admin -- promote --email you@x.com                             # grant the admin (reviewer) role
     npm run admin -- set-status --member slug --status verified|unverified|pending|revoked
     npm run admin -- list-codes                                            # every member's referral code and link */
import { loadEnv } from '../server/env.ts';
import { getDb } from '../server/db/client.ts';
import { migrate } from '../server/db/migrate.ts';
import { hashPassword } from '../server/auth/password.ts';
import { audit } from '../server/lib/audit.ts';
import { generateCode, codeCandidates, displayCode } from '../server/lib/referral.ts';
import { slugify } from '../server/lib/members.ts';
import { refreshScore } from '../server/lib/score.ts';
import { isUniqueViolation } from '../server/db/client.ts';

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name: string): string | undefined => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const flag = (name: string): boolean => args.includes(`--${name}`);
const env = loadEnv();
const db = await getDb(env);
await migrate(db);

try {
  if (cmd === 'create-user') {
    const email = opt('email')?.toLowerCase(), password = opt('password'), memberSlug = opt('member'), name = opt('name');
    if (!email || !password || password.length < 10) throw new Error('--email and a --password of 10+ characters are required');
    const hash = await hashPassword(password);
    const role = flag('admin') || env.adminEmails.includes(email) ? 'admin' : 'member';
    await db.transaction(async (tx) => {
      const user = (await tx.query<{ id: string }>('insert into users (email, password_hash, role) values ($1, $2, $3) returning id', [email, hash, role])).rows[0]!;
      if (memberSlug) {
        const m = (await tx.query<{ id: string; user_id: string | null }>('select id, user_id from members where slug = $1', [memberSlug])).rows[0];
        if (!m) throw new Error(`no member with slug ${memberSlug}`);
        if (m.user_id) throw new Error(`member ${memberSlug} already has a login`);
        await tx.query('update members set user_id = $2, updated_at = now() where id = $1', [m.id, user.id]);
        await audit(tx, { action: 'account.attached', subjectType: 'member', subjectId: m.id, actorUserId: user.id, data: { by: 'admin-script' } });
      } else {
        const full = name || email.split('@')[0]!;
        for (let attempt = 0; attempt < 20; attempt++) {
          const slug = attempt === 0 ? slugify(full) : `${slugify(full)}-${attempt + 1}`;
          await tx.query('savepoint m');
          try {
            const m = (await tx.query<{ id: string }>('insert into members (user_id, slug, name, first_name, referral_code) values ($1, $2, $3, $4, $5) returning id', [user.id, slug, full, full.split(/\s+/)[0], generateCode()])).rows[0]!;
            await tx.query('release savepoint m');
            await refreshScore(tx, m.id);
            break;
          } catch (e) { await tx.query('rollback to savepoint m'); if (!isUniqueViolation(e)) throw e; }
        }
      }
      await audit(tx, { action: 'account.created', subjectType: 'user', subjectId: user.id, actorUserId: user.id, data: { role, by: 'admin-script' } });
    });
    console.info(`created ${role} account for ${email}${memberSlug ? ` attached to ${memberSlug}` : ''}`);
  } else if (cmd === 'set-code') {
    const slug = opt('member'), code = codeCandidates(opt('code') || '')[0];
    if (!slug || !code) throw new Error('--member and a valid --code (6 to 12 letters/digits) are required');
    const r = await db.query('update members set referral_code = $2, updated_at = now() where slug = $1', [slug, code]);
    if (!r.rowCount) throw new Error(`no member with slug ${slug}`);
    await audit(db, { action: 'referral.code_set', subjectType: 'member', subjectId: slug, data: { code, by: 'admin-script' } });
    console.info(`referral code for ${slug} is now ${displayCode(code)} (${code})`);
  } else if (cmd === 'promote') {
    const email = opt('email')?.toLowerCase();
    const r = await db.query('update users set role = $2, updated_at = now() where lower(email) = $1', [email, 'admin']);
    if (!r.rowCount) throw new Error(`no user ${email}`);
    console.info(`${email} is now an admin`);
  } else if (cmd === 'set-status') {
    const slug = opt('member'), status = opt('status');
    if (!slug || !['unverified', 'pending', 'verified', 'revoked'].includes(status || '')) throw new Error('--member and --status are required');
    await db.transaction(async (tx) => {
      const r = await tx.query<{ id: string }>(`update members set verification_status = $2, verified_on = case when $2 = 'verified' then coalesce(verified_on, current_date) else verified_on end, updated_at = now() where slug = $1 returning id`, [slug, status]);
      if (!r.rows[0]) throw new Error(`no member with slug ${slug}`);
      await refreshScore(tx, r.rows[0].id);
      await audit(tx, { action: 'member.status_changed', subjectType: 'member', subjectId: r.rows[0].id, data: { to: status, by: 'admin-script' } });
    });
    console.info(`${slug} is now ${status}`);
  } else if (cmd === 'list-codes') {
    const { rows } = await db.query<{ slug: string; name: string; referral_code: string; user_id: string | null }>('select slug, name, referral_code, user_id from members order by created_at');
    for (const r of rows) console.info(`${r.slug.padEnd(22)} ${displayCode(r.referral_code).padEnd(14)} ${env.APP_ORIGIN || ''}/join?ref=${r.referral_code}${r.user_id ? '' : '   (no login)'}`);
  } else {
    console.info('commands: create-user, set-code, promote, set-status, list-codes');
  }
} finally { await db.close(); }
