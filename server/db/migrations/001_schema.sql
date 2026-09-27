-- Trulinq backend schema. Forward-only; every later change is a new migration.

create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) between 3 and 254),
  password_hash text not null,
  role text not null default 'member' check (role in ('member', 'admin')),
  status text not null default 'active' check (status in ('active', 'disabled', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index users_email_key on users (lower(email));

create table members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references users (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) between 2 and 64),
  name text not null check (length(name) between 2 and 80),
  first_name text not null check (length(first_name) between 1 and 40),
  role text not null default '' check (length(role) <= 60),
  company text not null default '' check (length(company) <= 120),
  city text not null default '' check (length(city) <= 80),
  region text not null default '' check (length(region) <= 80),
  country text not null default '' check (length(country) <= 80),
  lat double precision check (lat is null or (lat between -90 and 90)),
  lng double precision check (lng is null or (lng between -180 and 180)),
  industry text not null default '' check (length(industry) <= 40),
  bio text not null default '' check (length(bio) <= 600),
  offers text not null default '' check (length(offers) <= 200),
  looking text not null default '' check (length(looking) <= 200),
  website text not null default '' check (length(website) <= 200),
  website_verified boolean not null default false,
  founded integer check (founded is null or (founded between 1800 and 2100)),
  photo text check (photo is null or length(photo) <= 300),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'revoked')),
  verified_on date,
  referral_code text not null unique check (referral_code ~ '^[A-Z0-9]{6,12}$'),
  referred_by uuid references members (id) on delete set null,
  followers integer not null default 0 check (followers >= 0),
  following integer not null default 0 check (following >= 0),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  joined_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (referred_by is null or referred_by <> id),
  check (verification_status <> 'verified' or verified_on is not null)
);
create index members_status_verified_idx on members (verification_status, verified_on desc);
create index members_industry_idx on members (industry);
create index members_referred_by_idx on members (referred_by);
create index members_name_idx on members (lower(name));

-- One referral per referred member, never to themselves. The referrer is also on members.referred_by; this table is
-- the auditable event with its code and source.
create table referrals (
  referred_member_id uuid primary key references members (id) on delete cascade,
  referrer_member_id uuid not null references members (id) on delete cascade,
  code text not null,
  source text not null default 'signup' check (source in ('signup', 'backfill', 'manual')),
  created_at timestamptz not null default now(),
  check (referred_member_id <> referrer_member_id)
);
create index referrals_referrer_idx on referrals (referrer_member_id, created_at desc);

-- The Trulinq Score: five factors (identity 45, profile 20, web 15, history 10, standing 10); total = 300 + 5.5 × sum.
create table member_scores (
  member_id uuid primary key references members (id) on delete cascade,
  identity integer not null check (identity between 0 and 45),
  profile integer not null check (profile between 0 and 20),
  web integer not null check (web between 0 and 15),
  history integer not null check (history between 0 and 10),
  standing integer not null check (standing between 0 and 10),
  total integer not null check (total between 300 and 850),
  source text not null default 'engine' check (source in ('engine', 'seed', 'manual')),
  computed_at timestamptz not null default now()
);
create index member_scores_total_idx on member_scores (total desc);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);
create index sessions_user_idx on sessions (user_id);
create index sessions_expires_idx on sessions (expires_at);

create table password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index password_resets_user_idx on password_resets (user_id);

create table rate_limits (
  key text primary key,
  window_start timestamptz not null default now(),
  count integer not null default 0
);

create table verification_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  reference text not null unique,
  status text not null default 'submitted' check (status in ('submitted', 'in_review', 'approved', 'rejected', 'withdrawn')),
  identity jsonb not null default '{}'::jsonb,
  business jsonb not null default '{}'::jsonb,
  terms_accepted_at timestamptz,
  provider text,
  provider_ref text,
  result jsonb,
  submitted_at timestamptz not null default now(),
  review_started_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references users (id) on delete set null,
  decision_note text check (decision_note is null or length(decision_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index verification_requests_member_idx on verification_requests (member_id, submitted_at desc);
create index verification_requests_status_idx on verification_requests (status, submitted_at);
-- a member has at most one open request at a time
create unique index verification_requests_open_key on verification_requests (member_id) where status in ('submitted', 'in_review');

create table verification_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references verification_requests (id) on delete cascade,
  kind text not null check (kind in ('identity', 'business', 'other')),
  storage_key text not null,
  original_name text not null check (length(original_name) <= 200),
  mime text not null check (length(mime) <= 100),
  bytes integer not null check (bytes between 1 and 20971520),
  sha256 text not null,
  uploaded_at timestamptz not null default now()
);
create index verification_documents_request_idx on verification_documents (request_id);

create table subscriptions (
  member_id uuid primary key references members (id) on delete cascade,
  plan text not null check (plan in ('member', 'verified_business', 'enterprise')),
  status text not null check (status in ('unconfigured', 'trialing', 'active', 'past_due', 'cancel_at_period_end', 'cancelled')),
  period text not null default 'yearly' check (period in ('monthly', 'yearly')),
  provider text,
  provider_ref text,
  card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  current_period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references members (id) on delete cascade,
  kind text not null check (kind in ('Win', 'Hiring', 'Offer', 'Update', 'Ask')),
  body text not null check (length(body) between 1 and 2000),
  reply_count integer not null default 0 check (reply_count >= 0),
  created_at timestamptz not null default now()
);
create index posts_created_idx on posts (created_at desc);
create index posts_member_idx on posts (member_id, created_at desc);

create table rooms (
  slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  emoji text not null default '',
  topic text not null default '',
  live boolean not null default false,
  sort integer not null default 0
);
create table room_members (
  room_slug text not null references rooms (slug) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_slug, member_id)
);
create table room_messages (
  id uuid primary key default gen_random_uuid(),
  room_slug text not null references rooms (slug) on delete cascade,
  member_id uuid not null references members (id) on delete cascade,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index room_messages_room_idx on room_messages (room_slug, created_at);

create table endorsements (
  id uuid primary key default gen_random_uuid(),
  to_member_id uuid not null references members (id) on delete cascade,
  from_member_id uuid not null references members (id) on delete cascade,
  body text not null check (length(body) between 10 and 600),
  created_at timestamptz not null default now(),
  unique (to_member_id, from_member_id),
  check (to_member_id <> from_member_id)
);
create index endorsements_to_idx on endorsements (to_member_id, created_at desc);

create table contact_messages (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  topic text not null check (topic in ('support', 'fraud', 'privacy', 'enterprise')),
  name text not null check (length(name) between 2 and 80),
  email text not null check (length(email) between 3 and 254),
  message text not null check (length(message) between 8 and 4000),
  profile_link text check (profile_link is null or length(profile_link) <= 300),
  wants_copy boolean not null default false,
  member_id uuid references members (id) on delete set null,
  ip_hash text,
  created_at timestamptz not null default now()
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  profile_link text not null check (length(profile_link) between 4 and 300),
  details text not null check (length(details) between 8 and 4000),
  reporter_email text check (reporter_email is null or length(reporter_email) <= 254),
  reporter_member_id uuid references members (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'closed')),
  ip_hash text,
  created_at timestamptz not null default now()
);

create table newsletter_subscribers (
  email text primary key check (length(email) between 3 and 254),
  created_at timestamptz not null default now()
);

create table audit_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_user_id uuid,
  actor_member_id uuid,
  action text not null,
  subject_type text not null,
  subject_id text not null,
  data jsonb not null default '{}'::jsonb,
  ip_hash text
);
create index audit_events_subject_idx on audit_events (subject_type, subject_id, at desc);
create index audit_events_action_idx on audit_events (action, at desc);
