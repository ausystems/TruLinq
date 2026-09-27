import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHarness, TYLER_CODE, signup, type Harness } from './helpers.ts';
import { displayCode } from '../server/lib/referral.ts';
import { computeFactors, totalOf } from '../server/lib/score.ts';

let h: Harness;
beforeAll(async () => { h = await createHarness(); });
afterAll(async () => { await h.db.close(); });

describe('migrations and seed', () => {
  it('applies the schema and seeds the roster with codes', async () => {
    const { rows } = await h.db.query<{ n: string }>('select count(*)::text as n from members');
    expect(Number(rows[0]!.n)).toBe(10);
    const tyler = (await h.db.query<{ id: string; referral_code: string; verification_status: string }>(`select id, referral_code, verification_status from members where slug = 'tyler-shirakawa'`)).rows[0]!;
    expect(tyler.referral_code).toBe(TYLER_CODE);
    expect(tyler.verification_status).toBe('verified');
    expect(tyler.id).toBe('0542e68e-ae26-4a7e-ae34-252ae5e022ed');
    /* the roster is exactly the members on the live product plus Ahmad Khalid: nobody else is seeded */
    const everyone = (await h.db.query<{ slug: string }>('select slug from members order by slug')).rows.map((r) => r.slug);
    expect(everyone).toEqual(['ahmad-khalid', 'chelsea-pferschy', 'david', 'makalea-medeiros', 'maverick-kang-jr', 'michael-onwumere', 'omai-kofi', 'palani-maharaj', 'preston-sinenci-jr', 'tyler-shirakawa']);
    const health = await h.call('GET', '/health');
    expect(health.body.ok).toBe(true);
    expect(health.body.migrations.pending).toEqual([]);
  });
  it('is idempotent: running migrate again applies nothing', async () => {
    const { migrate } = await import('../server/db/migrate.ts');
    expect(await migrate(h.db)).toEqual([]);
  });
});

describe('sign-up', () => {
  it('creates the account, the member, a unique code and a session (1, 2, 3)', async () => {
    const r = await signup(h, 'first@example.com', 'First Person');
    expect(r.status).toBe(201);
    expect(r.cookie).toMatch(/^tq_session=/);
    expect(r.body.member.id).toBe('first-person');
    expect(r.body.member.referralCode).toMatch(/^TL-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(r.body.member.referralLink).toMatch(/\/join\?ref=[A-Z0-9]{8}$/);
    expect(r.body.member.status).toBe('unverified');
    const me = await h.call('GET', '/me', { cookie: r.cookie });
    expect(me.status).toBe(200);
    expect(me.body.member.email).toBe('first@example.com');
    expect(me.body.referrals.referredBy).toEqual({ id: 'tyler-shirakawa', name: 'Tyler Shirakawa' });
    const { rows } = await h.db.query<{ password_hash: string }>('select password_hash from users where email = $1', ['first@example.com']);
    expect(rows[0]!.password_hash).toMatch(/^scrypt\$/);
    expect(rows[0]!.password_hash).not.toContain('passphrase');
  });
  it('gives every member a different code and keeps existing codes unchanged (3, 4)', async () => {
    const a = await signup(h, 'second@example.com', 'Second Person');
    const b = await signup(h, 'third@example.com', 'Second Person');
    expect(a.body.member.referralCode).not.toBe(b.body.member.referralCode);
    expect(b.body.member.id).toBe('second-person-2');
    const tyler = (await h.db.query<{ referral_code: string }>(`select referral_code from members where slug = 'tyler-shirakawa'`)).rows[0]!;
    expect(tyler.referral_code).toBe(TYLER_CODE);
    const codes = await h.db.query<{ n: string }>('select count(distinct referral_code)::text as n from members');
    const total = await h.db.query<{ n: string }>('select count(*)::text as n from members');
    expect(codes.rows[0]!.n).toBe(total.rows[0]!.n);
  });
  it('stores the referring member exactly once, never twice (6, 9)', async () => {
    const id = (await h.db.query<{ id: string; referred_by: string }>(`select id, referred_by from members where slug = 'first-person'`)).rows[0]!;
    const tylerId = (await h.db.query<{ id: string }>(`select id from members where slug = 'tyler-shirakawa'`)).rows[0]!.id;
    expect(id.referred_by).toBe(tylerId);
    const refs = await h.db.query<{ n: string }>('select count(*)::text as n from referrals where referred_member_id = $1', [id.id]);
    expect(refs.rows[0]!.n).toBe('1');
    /* a repeated attribution (a replayed callback, a refreshed page) changes nothing */
    await h.db.query('insert into referrals (referred_member_id, referrer_member_id, code, source) values ($1, $2, $3, $4) on conflict (referred_member_id) do nothing', [id.id, tylerId, TYLER_CODE, 'signup']);
    const again = await h.db.query<{ n: string }>('select count(*)::text as n from referrals where referred_member_id = $1', [id.id]);
    expect(again.rows[0]!.n).toBe('1');
    const mine = await h.call('GET', '/me/referrals', { cookie: (await h.call('POST', '/auth/login', { body: { email: 'first@example.com', password: 'a long passphrase 42' } })).cookie });
    expect(mine.body.count).toBe(0);
  });
  it('rejects an invalid code safely and requires one (7)', async () => {
    const bad = await signup(h, 'nobody@example.com', 'No Body', 'ZZZZZZZZ');
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe('invalid_code');
    const none = await signup(h, 'nobody@example.com', 'No Body', null);
    expect(none.status).toBe(400);
    expect(none.body.error.code).toBe('code_required');
    const lookup = await h.call('GET', '/referrals/ZZZZZZZZ');
    expect(lookup.status).toBe(404);
    expect((await h.db.query('select 1 from users where email = $1', ['nobody@example.com'])).rowCount).toBe(0);
  });
  it('refuses duplicate emails at the API and the database (19)', async () => {
    const dup = await signup(h, 'First@Example.com', 'Another Name');
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('email_taken');
    await expect(h.db.query(`insert into users (email, password_hash) values ('FIRST@example.com', 'x')`)).rejects.toMatchObject({ code: '23505' });
    await expect(h.db.query(`insert into members (slug, name, first_name, referral_code) values ('dup-code', 'Dup', 'Dup', $1)`, [TYLER_CODE])).rejects.toMatchObject({ code: '23505' });
  });
  it('rejects malformed payloads (18)', async () => {
    const r = await h.call('POST', '/auth/signup', { body: { name: 'X', email: 'not-an-email', password: 'short', code: TYLER_CODE, agree: false } });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('validation_error');
    expect(r.body.error.details.issues.length).toBeGreaterThan(0);
    const login = await h.call('POST', '/auth/login', { body: { email: 'first@example.com' } });
    expect(login.status).toBe(400);
    const junk = await h.call('POST', '/auth/login', { body: 'garbage' });
    expect(junk.status).toBe(400);
  });
});

describe('referral links', () => {
  it('resolves Tyler Shirakawa\'s E9EAF5 in every spelling the site produces (5)', async () => {
    for (const spelling of ['E9EAF5', 'e9eaf5', 'TL-E9EA-F5', 'TLE9EAF5']) {
      const r = await h.call('GET', `/referrals/${spelling}`);
      expect(r.status, spelling).toBe(200);
      expect(r.body.referrer.id).toBe('tyler-shirakawa');
    }
    const joined = await signup(h, 'via-tyler@example.com', 'Via Tyler', 'TL-E9EA-F5');
    expect(joined.status).toBe(201);
    expect(joined.body.referral.referrer.id).toBe('tyler-shirakawa');
  });
  it('shows a member their own code and link', async () => {
    const r = await h.call('POST', '/auth/login', { body: { email: 'first@example.com', password: 'a long passphrase 42' } });
    const mine = await h.call('GET', '/me/referrals', { cookie: r.cookie });
    expect(mine.body.code).toBe(displayCode(mine.body.raw));
    expect(mine.body.link).toBe(`https://trulinq.test/join?ref=${mine.body.raw}`);
  });
  it('never lets a member refer themselves (8)', async () => {
    const me = (await h.db.query<{ id: string; referral_code: string }>(`select id, referral_code from members where slug = 'first-person'`)).rows[0]!;
    await expect(h.db.query('update members set referred_by = $1 where id = $1', [me.id])).rejects.toMatchObject({ code: '23514' });
    await expect(h.db.query('insert into referrals (referred_member_id, referrer_member_id, code) values ($1, $1, $2)', [me.id, me.referral_code])).rejects.toMatchObject({ code: '23514' });
  });
});

describe('sessions', () => {
  it('persist, end on logout, and ignore forged or expired tokens (10)', async () => {
    const login = await h.call('POST', '/auth/login', { body: { email: 'first@example.com', password: 'a long passphrase 42' } });
    expect(login.status).toBe(200);
    const s = await h.call('GET', '/auth/session', { cookie: login.cookie });
    expect(s.body.user.email).toBe('first@example.com');
    const forged = await h.call('GET', '/auth/session', { cookie: 'tq_session=' + 'A'.repeat(43) });
    expect(forged.body.user).toBeNull();
    await h.db.query(`update sessions set expires_at = now() - interval '1 minute' where token_hash = (select token_hash from sessions order by created_at desc limit 1)`);
    const expired = await h.call('GET', '/auth/session', { cookie: login.cookie });
    expect(expired.body.user).toBeNull();
    const again = await h.call('POST', '/auth/login', { body: { email: 'first@example.com', password: 'a long passphrase 42' } });
    const out = await h.call('POST', '/auth/logout', { cookie: again.cookie });
    expect(out.status).toBe(200);
    expect(String(out.headers['set-cookie'])).toContain('Max-Age=0');
    expect((await h.call('GET', '/auth/session', { cookie: again.cookie })).body.user).toBeNull();
  });
  it('rejects wrong passwords and unknown emails identically', async () => {
    const wrong = await h.call('POST', '/auth/login', { body: { email: 'first@example.com', password: 'nope nope nope nope' } });
    const unknown = await h.call('POST', '/auth/login', { body: { email: 'ghost@example.com', password: 'nope nope nope nope' } });
    expect(wrong.status).toBe(401); expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });
  it('blocks state changes without the CSRF header or from a foreign origin', async () => {
    const r = await h.call('POST', '/auth/login', { body: { email: 'first@example.com', password: 'a long passphrase 42' }, csrf: false });
    expect(r.status).toBe(403);
    const evil = await h.call('POST', '/auth/login', { body: { email: 'first@example.com', password: 'a long passphrase 42' }, headers: { origin: 'https://evil.example' } });
    expect(evil.status).toBe(403);
  });
});

describe('authorization', () => {
  let a: string, b: string;
  beforeAll(async () => {
    a = (await h.call('POST', '/auth/login', { body: { email: 'first@example.com', password: 'a long passphrase 42' } })).cookie!;
    b = (await h.call('POST', '/auth/login', { body: { email: 'second@example.com', password: 'a long passphrase 42' } })).cookie!;
  });
  it('rejects anonymous callers on protected endpoints (11)', async () => {
    for (const [m, p, body] of [['GET', '/me'], ['PATCH', '/me', { bio: 'x' }], ['GET', '/me/referrals'], ['POST', '/me/verification', {}], ['POST', '/posts', { kind: 'Win', body: 'hi' }], ['GET', '/admin/verification']] as const) {
      const r = await h.call(m, p, { body });
      expect(r.status, `${m} ${p}`).toBe(401);
    }
  });
  it('lets a member update only their own profile, and only permitted fields (12, 13, 14, 15)', async () => {
    const ok = await h.call('PATCH', '/me', { cookie: a, body: { bio: 'Hello from A', website: 'https://a.example/' } });
    expect(ok.status).toBe(200);
    expect(ok.body.member.bio).toBe('Hello from A');
    expect(ok.body.member.website).toBe('a.example');
    const bRow = (await h.db.query<{ bio: string }>(`select bio from members where slug = 'second-person'`)).rows[0]!;
    expect(bRow.bio).toBe('');
    for (const body of [{ referralCode: 'AAAAAAAA' }, { referral_code: 'AAAAAAAA' }, { verification_status: 'verified' }, { status: 'verified' }, { score: 850 }, { factors: [45, 20, 15, 10, 10] }, { id: 'second-person' }, { user_id: 'x' }]) {
      const r = await h.call('PATCH', '/me', { cookie: a, body });
      expect(r.status, JSON.stringify(body)).toBe(400);
    }
    const after = await h.call('GET', '/me', { cookie: a });
    expect(after.body.member.status).toBe('unverified');
    expect(after.body.member.factors[0]).toBe(0);
    expect(after.body.member.referralCode).toBe(ok.body.member.referralCode);
  });
  it('keeps admin-only actions away from members', async () => {
    const q = await h.call('GET', '/admin/verification', { cookie: a });
    expect(q.status).toBe(403);
    const s = await h.call('POST', '/admin/members/second-person/status', { cookie: a, body: { status: 'verified' } });
    expect(s.status).toBe(403);
    const b2 = (await h.db.query<{ verification_status: string }>(`select verification_status from members where slug = 'second-person'`)).rows[0]!;
    expect(b2.verification_status).toBe('unverified');
  });
  it('keeps unverified members read-only in the feed and rooms', async () => {
    expect((await h.call('POST', '/posts', { cookie: b, body: { kind: 'Win', body: 'not yet' } })).status).toBe(403);
    expect((await h.call('POST', '/rooms/lounge/messages', { cookie: b, body: { body: 'not yet' } })).status).toBe(403);
    expect((await h.call('POST', '/members/tyler-shirakawa/endorsements', { cookie: b, body: { body: 'A fine person to work with.' } })).status).toBe(403);
  });
});

describe('verification and score', () => {
  const application = {
    identity: { first: 'First', last: 'Person', dob: '1990-05-05', country: 'United States', idType: 'Passport' },
    business: { name: 'First Person LLC', registration: 'HI-123-456', registeredIn: 'Hawaiʻi', website: 'firstperson.example', industry: 'Technology', role: 'Founder', authorised: true },
    terms: true
  };
  let a: string, admin: string;
  beforeAll(async () => {
    a = (await h.call('POST', '/auth/login', { body: { email: 'first@example.com', password: 'a long passphrase 42' } })).cookie!;
    const r = await signup(h, 'admin@trulinq.test', 'Admin Person');
    expect(r.body.user.role).toBe('admin');
    admin = r.cookie!;
  });
  it('submitting an application makes the member pending, never verified (14)', async () => {
    const bad = await h.call('POST', '/me/verification', { cookie: a, body: { ...application, identity: { ...application.identity, dob: '2015-01-01' } } });
    expect(bad.status).toBe(400);
    const r = await h.call('POST', '/me/verification', { cookie: a, body: application });
    expect(r.status).toBe(201);
    expect(r.body.request.reference).toMatch(/^TQ-\d{4}-\d{4}-[A-Z0-9]{4}$/);
    expect(r.body.status).toBe('pending');
    const me = await h.call('GET', '/me', { cookie: a });
    expect(me.body.member.status).toBe('pending');
    expect(me.body.verification.status).toBe('submitted');
    const again = await h.call('POST', '/me/verification', { cookie: a, body: application });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('request_open');
  });
  it('refuses uploads when no storage is configured, without pretending', async () => {
    const me = await h.call('GET', '/me', { cookie: a });
    const r = await h.call('PUT', `/me/verification/${me.body.verification.id}/documents?kind=identity&name=passport.jpg`, { cookie: a, raw: Buffer.from('not really a jpeg'), headers: { 'content-type': 'image/jpeg' } });
    expect(r.status).toBe(503);
    expect(r.body.error.code).toBe('storage_not_configured');
    expect((await h.db.query('select 1 from verification_documents')).rowCount).toBe(0);
  });
  it('only an admin decision verifies, and the score engine follows trusted data (15)', async () => {
    const queue = await h.call('GET', '/admin/verification', { cookie: admin });
    expect(queue.status).toBe(200);
    const req = queue.body.requests.find((x: { member: { id: string } }) => x.member.id === 'first-person');
    expect(req).toBeTruthy();
    const review = await h.call('POST', `/admin/verification/${req.id}/decision`, { cookie: admin, body: { decision: 'in_review' } });
    expect(review.status).toBe(200);
    const before = await h.call('GET', '/me', { cookie: a });
    expect(before.body.member.factors[0]).toBe(0);
    const approve = await h.call('POST', `/admin/verification/${req.id}/decision`, { cookie: admin, body: { decision: 'approve', websiteVerified: true, note: 'Registry matched.' } });
    expect(approve.status).toBe(200);
    expect(approve.body.member.status).toBe('verified');
    const me = await h.call('GET', '/me', { cookie: a });
    expect(me.body.member.status).toBe('verified');
    expect(me.body.member.verifiedOn).toBeTruthy();
    expect(me.body.member.factors[0]).toBe(45);
    expect(me.body.member.factors[2]).toBe(15);
    expect(me.body.member.score).toBe(totalOf({ identity: 45, profile: me.body.member.factors[1], web: 15, history: 0, standing: 0 }));
    const closed = await h.call('POST', `/admin/verification/${req.id}/decision`, { cookie: admin, body: { decision: 'reject' } });
    expect(closed.status).toBe(409);
    const events = await h.call('GET', `/admin/audit?subjectType=verification_request&subjectId=${req.id}`, { cookie: admin });
    expect(events.body.events.map((e: { action: string }) => e.action)).toEqual(expect.arrayContaining(['verification.submitted', 'verification.in_review', 'verification.approve']));
  });
  it('computes factors deterministically from trusted fields', () => {
    const f = computeFactors({ verification_status: 'verified', verified_on: '2026-01-01', joined_on: '2025-12-01', photo: null, bio: 'b', industry: 'Technology', city: 'Hilo', website: 'x.example', website_verified: false, founded: 2020, offers: 'o', looking: 'l' }, new Date('2026-09-27T00:00:00Z'));
    expect(f).toEqual({ identity: 45, profile: 18, web: 10, history: 3, standing: 9 });
    expect(totalOf(f)).toBe(768);
    /* the live product's own numbers: Tyler, 26 days on Trulinq with the stamp → history 0, standing 1 */
    const t = computeFactors({ verification_status: 'verified', verified_on: '2026-09-01', joined_on: '2026-09-01', photo: 'x', bio: 'b', industry: 'Marketing', city: 'Hilo', website: 'trulinqid.com', website_verified: true, founded: 2020, offers: 'o', looking: 'l' }, new Date('2026-09-27T05:00:00Z'));
    expect([t.history, t.standing]).toEqual([0, 1]);
  });
  it('a verified member can post, speak in rooms and endorse once', async () => {
    const post = await h.call('POST', '/posts', { cookie: a, body: { kind: 'Win', body: 'First post from a real account.' } });
    expect(post.status).toBe(201);
    expect(post.body.post.author.id).toBe('first-person');
    const feed = await h.call('GET', '/posts?limit=5');
    expect(feed.body.posts[0].id).toBe(post.body.post.id);
    const msg = await h.call('POST', '/rooms/lounge/messages', { cookie: a, body: { body: 'Hello room.' } });
    expect(msg.status).toBe(201);
    const msgs = await h.call('GET', '/rooms/lounge/messages');
    expect(msgs.body.messages.at(-1).text).toBe('Hello room.');
    const e1 = await h.call('POST', '/members/tyler-shirakawa/endorsements', { cookie: a, body: { body: 'Tyler delivered exactly what he promised.' } });
    expect(e1.status).toBe(201);
    const e2 = await h.call('POST', '/members/tyler-shirakawa/endorsements', { cookie: a, body: { body: 'Trying to say it twice.' } });
    expect(e2.status).toBe(409);
    const self = await h.call('POST', '/members/first-person/endorsements', { cookie: a, body: { body: 'I am wonderful, honestly.' } });
    expect(self.status).toBe(400);
    expect(self.body.error.code).toBe('self_endorsement');
  });
});

describe('public data', () => {
  it('serves a public profile with the live product\'s score and the endorsement written here (16)', async () => {
    const r = await h.call('GET', '/members/tyler-shirakawa');
    expect(r.status).toBe(200);
    expect(r.body.member.name).toBe('Tyler Shirakawa');
    expect(r.body.member.headline).toBe('CEO of Trulinq');
    expect(r.body.member.score).toBe(746);
    expect([r.body.member.grade, r.body.member.band]).toEqual(['AA', 'Excellent']);
    expect(r.body.member.factors).toEqual([45, 20, 15, 0, 1]);
    expect(r.body.endorsements.length).toBe(1);
    expect(r.body.posts.length).toBe(0);
    expect(r.body.member).not.toHaveProperty('email');
    expect(r.body.member).not.toHaveProperty('referralCode');
    expect(r.body.member.photo).toBeNull();
    const chelsea = await h.call('GET', '/members/chelsea-pferschy');
    expect([chelsea.body.member.score, chelsea.body.member.grade, chelsea.body.member.band]).toEqual([652, 'B', 'Fair']);
  });
  it('lists, searches, sorts and paginates members', async () => {
    const all = await h.call('GET', '/members');
    expect(all.body.total).toBeGreaterThanOrEqual(11);
    expect(all.body.members[0]).toHaveProperty('factors');
    const q = await h.call('GET', '/members?q=honolulu%20ventures&industry=Technology');
    expect(q.body.members.map((m: { id: string }) => m.id)).toEqual(['preston-sinenci-jr']);
    const byHeadline = await h.call('GET', '/members?q=data%20center');
    expect(byHeadline.body.members.map((m: { id: string }) => m.id)).toContain('david');
    const page = await h.call('GET', '/members?limit=5&page=2&sort=az');
    expect(page.body.members.length).toBe(5);
    const bad = await h.call('GET', '/members?limit=500');
    expect(bad.status).toBe(400);
    /* members still in review appear only when asked for */
    await signup(h, 'in-review@example.com', 'Person In Review');
    expect((await h.call('GET', '/members?q=review')).body.members.map((m: { id: string }) => m.id)).not.toContain('person-in-review');
    const everyone = await h.call('GET', '/members?q=review&status=all');
    expect(everyone.body.members.map((m: { id: string; status: string }) => [m.id, m.status])).toContainEqual(['person-in-review', 'unverified']);
  });
  it('returns safe errors for missing or private profiles (17)', async () => {
    const missing = await h.call('GET', '/members/nobody-here');
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('member_not_found');
    expect((await h.call('GET', '/members/DROP%20TABLE')).status).toBe(400);
    const a = (await h.call('POST', '/auth/login', { body: { email: 'first@example.com', password: 'a long passphrase 42' } })).cookie!;
    await h.call('PATCH', '/me', { cookie: a, body: { visibility: 'private' } });
    expect((await h.call('GET', '/members/first-person')).status).toBe(404);
    expect((await h.call('GET', '/members/first-person', { cookie: a })).status).toBe(200);
    expect((await h.call('GET', '/members')).body.members.map((m: { id: string }) => m.id)).not.toContain('first-person');
    await h.call('PATCH', '/me', { cookie: a, body: { visibility: 'public' } });
  });
  it('serves rooms, stats and the forms', async () => {
    const rooms = await h.call('GET', '/rooms');
    expect(rooms.body.rooms.map((r: { slug: string }) => r.slug)).toEqual(['lounge', 'retail', 'saas', 'trade']);
    expect(rooms.body.rooms[0].members.length).toBeLessThanOrEqual(3);
    expect(rooms.body.rooms.find((r: { slug: string }) => r.slug === 'lounge').lastMessageAt).toBeTruthy();
    expect(rooms.body.rooms.find((r: { slug: string }) => r.slug === 'trade').lastMessageAt).toBeNull();
    const stats = await h.call('GET', '/stats');
    expect(stats.body.verified).toBeGreaterThanOrEqual(10);
    expect(stats.body.revoked).toBe(0);
    expect(stats.body).not.toHaveProperty('deals');
    const contact = await h.call('POST', '/contact', { body: { topic: 'support', name: 'Someone', email: 'someone@example.com', message: 'I would like an invitation code, please.' } });
    expect(contact.status).toBe(201);
    expect(contact.body.reference).toMatch(/^TQ-CT-[A-Z0-9]{4}$/);
    expect(contact.body.delivered).toBe(false);
    const report = await h.call('POST', '/reports', { body: { link: 'tru-linq.vercel.app/members/x', details: 'This profile is using someone else’s photo.', email: '' } });
    expect(report.status).toBe(201);
    const news = await h.call('POST', '/newsletter', { body: { email: 'news@example.com' } });
    expect(news.status).toBe(201);
    expect((await h.call('POST', '/newsletter', { body: { email: 'news@example.com' } })).status).toBe(201);
    expect((await h.db.query(`select 1 from newsletter_subscribers where email = 'news@example.com'`)).rowCount).toBe(1);
  });
});

describe('abuse protection', () => {
  it('rate-limits sign-ups per address', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await signup(h, `burst${i}@example.com`, 'Burst Person', TYLER_CODE, { ip: '198.51.100.9' })).status;
    expect(last).toBe(429);
  });
  it('password reset never reveals whether an email exists and reports delivery honestly', async () => {
    const known = await h.call('POST', '/auth/password-reset/request', { body: { email: 'first@example.com' } });
    const unknown = await h.call('POST', '/auth/password-reset/request', { body: { email: 'ghost@example.com' } });
    expect(known.status).toBe(200); expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(known.body.delivered).toBe(false);
    expect(known.body.reason).toBe('email_not_configured');
    const { rows } = await h.db.query<{ token_hash: string }>('select token_hash from password_resets');
    expect(rows.length).toBe(1);
    const bad = await h.call('POST', '/auth/password-reset/confirm', { body: { token: 'A'.repeat(43), password: 'a brand new passphrase' } });
    expect(bad.status).toBe(400);
  });
});
