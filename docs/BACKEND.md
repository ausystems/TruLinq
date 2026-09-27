# Trulinq backend

The site is a Vite multi-page app. Its backend is a single Vercel Serverless Function (`api/[[...path]].js`, bundled
by `scripts/build-api.mjs` from `server/vercel.ts` on every build) that hands every `/api/*` request to a
framework-agnostic router in `server/`, backed by Postgres. Locally the same router runs in a
Node process (`server/dev.ts`) against an embedded Postgres (PGlite), so `npm run dev` needs no external services.

## Architecture

```
browser ── /api/* ──▶ api/[[...path]].js (Vercel)  ─┐
                      server/dev.ts (local, :5190) ─┴─▶ server/index.ts (router, CORS, sessions, CSRF, errors)
                                                          ├─ server/routes/*      one module per area
                                                          ├─ server/lib/*        validation, scoring, referral codes, rate limits, audit, email, storage
                                                          ├─ server/auth/*       scrypt passwords, opaque sessions
                                                          └─ server/db/*         pg | PGlite client, migration runner, SQL migrations
```

* `src/js/api.js` is the browser client (same-origin `/api`, or `VITE_API_BASE` on static hosts). It sends the session
  cookie and the `X-Requested-With` header the server requires for every state change.
* `src/js/data.js` loads members, posts, rooms, stats and the session for the pages. When the API cannot be reached at
  all (a static host with no backend configured) the read-only pages fall back to the bundled demo roster, which is
  the same content the database is seeded with. Nothing that writes ever falls back.
* Responses are JSON. Errors are `{ "error": { "code", "message", "details"? } }` with proper status codes
  (400 validation, 401, 403, 404, 409, 413, 429 with `Retry-After`, 503 when a dependency is missing, 500 generic).
  Stack traces, SQL and secrets never reach the client.

## Database model (`server/db/migrations/001_schema.sql`)

| table | purpose |
| --- | --- |
| `users` | login identity: email (unique, case-insensitive), scrypt password hash, role `member|admin`, status |
| `members` | the profile the site shows: slug, name, business fields, location, portrait, `verification_status`, `verified_on`, unique `referral_code`, `referred_by`, visibility |
| `referrals` | one row per referred member (PK), the referrer, the code used, the source; cannot reference itself |
| `member_scores` | the five Trulinq Score factors and total per member, `source` = `seed`, `engine` or `manual` |
| `sessions` | opaque session tokens (SHA-256 only), sliding expiry |
| `password_resets` | one-hour reset tokens (hashed), single use |
| `rate_limits` | fixed-window counters keyed by action and hashed IP / account |
| `verification_requests` | an application: identity and business details (no document content), status, provider fields, decision and timestamps; at most one open request per member |
| `verification_documents` | metadata of uploaded documents (storage key, hash, size); bytes live in private blob storage |
| `subscriptions` | plan, status, period, provider reference (Stripe-ready) |
| `posts`, `rooms`, `room_members`, `room_messages`, `endorsements` | the content the feed, rooms and profiles show; endorsements are unique per pair and never self |
| `contact_messages`, `reports`, `newsletter_subscribers` | the site's forms |
| `audit_events` | trust-related changes: account creation, referral attribution, verification decisions, status changes, endorsements |

Constraints do the enforcing: every foreign key, `check` on statuses, ranges and text lengths, unique indexes on
`lower(email)`, `slug`, `referral_code`, `(to, from)` endorsements, one open verification request per member.

`002_seed.sql` inserts the demo roster the site launched with (17 members with fixed referral codes, posts, rooms,
endorsements). It is idempotent (`on conflict do nothing`). Regenerate it from `src/data/*.js` with `npm run db:seed:gen`.

## Authentication

* Sign-up (`POST /api/auth/signup`): validates, checks the invitation code, hashes the password with scrypt
  (N=2^15, r=8, p=1, 16-byte salt), then in one transaction creates the user, the member (unique slug and referral
  code, retried inside savepoints on collision), the referral row, the score, the audit rows. Returns 201 with a
  session cookie. Duplicate email → 409 `email_taken` (also enforced by the unique index).
* Sign-in (`POST /api/auth/login`): the same scrypt work runs whether or not the email exists, so timing does not reveal
  accounts; wrong password and unknown email return the same 401. Disabled accounts get 403.
* Sessions: 256-bit random token in an `httpOnly; Secure; SameSite=Lax` cookie (`tq_session`), only its SHA-256 stored;
  30 days sliding. `GET /api/auth/session` restores state; `POST /api/auth/logout` deletes the session and clears the cookie.
* CSRF: every non-GET request must carry `X-Requested-With`, and a browser-sent `Origin` must be the site's own or in
  `ALLOWED_ORIGINS`. Cookies are `SameSite=Lax`.
* Password reset: `POST /api/auth/password-reset/request` always answers 200 with the same body; with `RESEND_API_KEY`
  set the email goes out, otherwise `delivered: false, reason: "email_not_configured"` and the UI says so.
  `POST /api/auth/password-reset/confirm` swaps the password, revokes every session and signs the user in.
* Roles: emails in `ADMIN_EMAILS` become admins on sign-up / sign-in; `npm run admin -- promote --email x` does it later.

## Referrals

* Every member has a unique 8-character code (alphabet without look-alikes, never starting with `TL`); the site shows it
  as `TL-XXXX-XXXX`. Codes of 6 to 12 characters from elsewhere (for example `E9EAF5`) are accepted as they are.
* The referral link is `/join?ref=CODE` → redirects to `/auth/?mode=signup&ref=CODE` → the sign-up form is prefilled.
* Attribution happens once, on the server, when the account is created: `members.referred_by` plus one `referrals` row
  (primary key = referred member, so a replay or refresh cannot add a second one). A member cannot be referred by
  themselves (check constraints on both tables). Invalid codes fail with 400/404 and nothing is written.
* `GET /api/referrals/:code` validates a code (rate-limited). `GET /api/me/referrals` returns a member's code, link,
  count and the members they referred.
* Existing codes are never regenerated. Seed members' codes are fixed in the seed migration; `npm run admin -- list-codes`
  prints them, `npm run admin -- set-code --member <slug> --code E9EAF5` keeps a legacy code for a member.

## Verification

* `POST /api/me/verification` records an application (identity fields, business fields, terms) with a reference like
  `TQ-2026-0927-7K2M`, sets the member to `pending`, fills in empty profile fields from the business details, audits.
  A member can have one open application; a second submit answers 409 with the open reference.
* `PUT /api/me/verification/:id/documents` stores the document bytes in private blob storage (Vercel Blob via
  `BLOB_READ_WRITE_TOKEN`) and only metadata in the database. Without the token it answers 503 `storage_not_configured`
  and the UI tells the applicant a reviewer will ask for the document.
* Only admins change status: `POST /api/admin/verification/:id/decision` with `in_review`, `approve` (sets the member
  `verified`, `verified_on`, optionally `website_verified`) or `reject`. `POST /api/admin/members/:slug/status` revokes
  or restores. Every decision writes an audit row. No client can set `verification_status`; profile updates use a
  strict whitelist and reject unknown fields with 400.
* The request stores `provider` / `provider_ref` / `result` for a future identity-verification provider; today the
  decision is a human reviewer's.

## Trulinq Score

The score the site already shows: five factors, `identity` 45, `profile` 20, `web` 15, `history` 10, `standing` 10,
`total = 300 + 5.5 × sum` (300 to 850), grades AA ≥ 740, A ≥ 700, B ≥ 580, C ≥ 480. `server/lib/score.ts` is the source
of truth. Real members are computed from trusted records only: identity 45 once verified; profile from the eight
details on file; web 10 for a linked website, 15 when the reviewer confirmed it; history and standing from months on
Trulinq and months holding the stamp. Scores refresh on every profile write, on verification decisions and whenever a
member loads their own dashboard; `POST /api/admin/scores/recompute` refreshes everyone. Seeded demo members keep their
seeded factors (`source = 'seed'`). No endpoint accepts a score or factors from a client.

## Authorization

* Anonymous: public members, profiles, posts, rooms, stats, forms, referral checks.
* Signed in: `GET/PATCH /api/me`, referrals, verification. `PATCH /api/me` can only touch the caller's own row and only
  whitelisted fields; there is no endpoint that updates another member by id.
* Verified members: create posts, room messages, endorsements (one per target, never self).
* Admins: the verification queue and decisions, member status, score recompute, the audit log.
* Private members are invisible to everyone but themselves and admins.

## Abuse protection

Postgres-backed fixed-window limits (so they hold across serverless instances): sign-up 10/hour per IP, login 30/15 min
per IP and 10/15 min per email, password reset 5/hour per IP and 3/hour per email, referral checks 60/10 min, contact and
reports 10/hour, posts 20/hour, messages 60/hour, endorsements 20/day, uploads 20/hour. IPs are stored only as salted
hashes (`RATE_LIMIT_SALT`).

## Environment

See `.env.example`. Server-only: `DATABASE_URL`, `ALLOWED_ORIGINS`, `ADMIN_EMAILS`, `APP_ORIGIN`, `RESEND_API_KEY`,
`EMAIL_FROM`, `BLOB_READ_WRITE_TOKEN`, `STRIPE_SECRET_KEY`, `SESSION_TTL_DAYS`, `RATE_LIMIT_SALT`,
`SIGNUP_REQUIRES_INVITE`. Public (bundled): `VITE_API_BASE`. Nothing server-side is ever prefixed `VITE_`.

## Migrations

`server/db/migrations/*.sql` are forward-only and recorded in `schema_migrations` with a checksum (editing an applied
file fails loudly). `npm run db:bundle` embeds them into `server/db/migrations/index.ts` (run automatically before dev,
test and build). `npm run db:migrate` applies pending ones; the Vercel build runs it first (`vercel-build`), and the API
also applies pending migrations on cold start under an advisory lock, so a deploy is never ahead of its schema.

## Running and testing

```bash
npm run dev          # API on :5190 (embedded Postgres in .data/) + Vite on :5180 with /api proxied
npm test             # 29 backend tests against an in-memory Postgres (PGlite): sign-up, referrals, sessions, authz, verification, score, content, forms, limits
npm run typecheck    # tsc, strict
npm run lint         # eslint on server/, api/, tests/
npm run build        # production bundle
npm run admin -- …   # operator commands (see scripts/admin.ts)
```

The embedded PGlite store in `.data/` is single-process: stop `npm run dev` before running `npm run admin` or `npm run
db:migrate` against it, or point both at a real `DATABASE_URL`.

## Deploying

Vercel builds from `main`. Set the server-only variables in the project settings (at minimum `DATABASE_URL`, e.g. a Neon
Postgres, and `ADMIN_EMAILS`); the build applies migrations, then serves the static site and the function. Without
`DATABASE_URL` the site still deploys, the API answers 503 `database_unavailable`, read-only pages show the seed roster
and every form says the backend is not connected. GitHub Pages (`npm run deploy`) is static only: build it with
`VITE_API_BASE=https://<vercel-host>/api` and add the Pages origin to `ALLOWED_ORIGINS` on Vercel to use the API from there.
