-- Phase 1 schema. See docs/phase-1-prd.md §6.
-- No external_media / watch_list / hypotheses / ideas / hooks / prospects here —
-- those belong to Phase 2+ and are added in later migrations, not now.

create extension if not exists pgcrypto;

create table accounts (
  id uuid primary key default gen_random_uuid(),
  platform text not null default 'instagram',
  ig_user_id text not null unique,
  handle text not null,
  owner text not null check (owner in ('francis','bailey')),
  page_id text not null,
  token_ref text not null, -- name of the Vercel Sensitive env var, never the token itself
  created_at timestamptz not null default now()
);

create table media (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id),
  ig_media_id text not null unique,
  media_type text not null check (media_type in ('IMAGE','VIDEO','CAROUSEL_ALBUM')),
  media_product_type text not null check (media_product_type in ('FEED','REELS','STORY','AD')),
  permalink text,
  caption text,
  posted_at timestamptz not null,
  transcript text,
  ocr_text text,
  skip_reason text, -- e.g. 'pre_conversion' — mirrors the old pipeline's media_skip table
  created_at timestamptz not null default now()
);

create table media_metrics_daily (
  media_id uuid not null references media(id),
  date date not null,
  reach int,
  views int,
  likes int,
  comments int,
  saved int,
  shares int,
  total_interactions int,
  avg_watch_time_s numeric,
  reels_skip_rate numeric,
  profile_visits int, -- null for REELS; only populated when Meta returns it (FEED/STORY)
  follows int,        -- same caveat
  primary key (media_id, date)
);

create table account_metrics_daily (
  account_id uuid not null references accounts(id),
  date date not null,
  reach int,
  follows int,
  unfollows int,
  primary key (account_id, date)
);
-- This is what the correlation model reads (PRD §2): daily follows here vs.
-- per-Reel reach in media_metrics_daily, lagged. Never a substitute for a
-- direct per-post profile-visit count, which Reels don't expose.

create table taxonomy (
  dimension text not null,
  value text not null,
  definition text not null,
  primary key (dimension, value)
);

create table tags (
  media_id uuid not null references media(id),
  dimension text not null,
  value text not null,
  primary key (media_id, dimension)
);

create table benchmarks (
  scope text not null,  -- e.g. 'account:francis' | 'format:reels' | 'hook_modality:motion'
  metric text not null,
  p50 numeric,
  p90 numeric,
  window text not null, -- e.g. '90d'
  computed_at timestamptz not null default now(),
  primary key (scope, metric, window)
);

create table insights (
  id uuid primary key default gen_random_uuid(),
  claim text not null,
  slice text not null,
  effect_size numeric,
  n int not null,
  window text not null,
  evidence_media_ids uuid[] not null,
  status text not null check (status in ('confirmed','emerging')),
  created_at timestamptz not null default now()
);

create table digests (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  kind text not null check (kind = 'weekly'),
  payload_json jsonb not null,
  sent_at timestamptz
);

-- RLS: enabled everywhere, no public role. Replace the placeholder emails
-- below with Francis's and Bailey's actual Supabase auth emails before
-- applying this migration for real — do not guess or hardcode without
-- confirming with them first.
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'accounts','media','media_metrics_daily','account_metrics_daily',
    'taxonomy','tags','benchmarks','insights','digests'
  ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'create policy %I on %I for all using (auth.email() in (''REPLACE_WITH_FRANCIS_EMAIL'', ''REPLACE_WITH_BAILEY_EMAIL''));',
      t || '_owner_access', t
    );
  end loop;
end $$;
