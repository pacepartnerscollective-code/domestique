-- Convenience snapshot = migrations/0001 + 0002 + 0003, concatenated.
-- For the first-time setup: open this file, copy all, paste into the
-- Supabase SQL Editor (Dashboard -> SQL Editor -> New query), Run once.
-- The numbered files in migrations/ remain the source of truth for any
-- later `supabase db push`.
-- ============================================================

-- Phase 1 schema.

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
  skip_reason text,
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
  profile_visits int,
  follows int,
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
  scope text not null,
  metric text not null,
  p50 numeric,
  p90 numeric,
  window text not null,
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
  end loop;
end $$;

-- ============================================================
-- Taxonomy seed (12 dimensions; `topic` is open-vocabulary, not seeded).

insert into taxonomy (dimension, value, definition) values
  ('hook_modality','face','Opens on someone talking directly to camera'),
  ('hook_modality','voiceover','Opens with narration over footage, no face to camera'),
  ('hook_modality','text','On-screen text carries the hook, no speech'),
  ('hook_modality','motion','Pure action/B-roll opens the video, no dialogue or text'),

  ('hook_type','curiosity_gap','Withholds information to create a question the viewer wants answered'),
  ('hook_type','bold_claim','Opens with a strong, specific assertion'),
  ('hook_type','relatable_problem','Names a problem the viewer recognizes in themselves'),
  ('hook_type','how_to_promise','States the payoff/skill the video will deliver'),
  ('hook_type','story_open','Opens mid-narrative, "this happened to me"'),
  ('hook_type','stat_shock','Leads with a surprising number or fact'),
  ('hook_type','pattern_interrupt','Visually or verbally breaks expectation to stop the scroll'),
  ('hook_type','direct_cta','Opens by telling the viewer what to do'),

  ('format','talking_head','Person speaking to camera, minimal cutaways'),
  ('format','vlog','Follows a real activity/day as it happens'),
  ('format','tutorial','Step-by-step instructional structure'),
  ('format','listicle','Enumerated list structure ("3 things...")'),
  ('format','pov_skit','Staged point-of-view scenario'),
  ('format','cinematic_montage','Music-driven visual sequence, little/no dialogue'),
  ('format','challenge','A defined challenge or stunt structure'),
  ('format','qna','Answering a specific question or comment'),

  ('length_bucket','under_15s','Under 15 seconds'),
  ('length_bucket','15_30s','15 to 30 seconds'),
  ('length_bucket','30_60s','30 to 60 seconds'),
  ('length_bucket','over_60s','Over 60 seconds'),

  ('audio_type','trending_sound','Uses a currently-trending audio track'),
  ('audio_type','original_sound','Uses the creator''s own original audio'),
  ('audio_type','licensed_music','Uses a specific, non-trending licensed track'),
  ('audio_type','voiceover_only','No music bed, voiceover carries the audio'),
  ('audio_type','ambient_sync','Natural/ambient sound only, no added track'),

  ('onscreen_text_density','none','No burned-in text'),
  ('onscreen_text_density','light','Title or CTA text only'),
  ('onscreen_text_density','heavy','Captions or lists run throughout'),

  ('first_frame_kind','face','A face is the first thing shown'),
  ('first_frame_kind','text_hook','Text is the first thing shown'),
  ('first_frame_kind','action_shot','Motion/action is the first thing shown'),
  ('first_frame_kind','landscape','A wide/establishing shot opens the video'),
  ('first_frame_kind','product','A product or object is the first thing shown'),

  ('location_type','urban','City street or built environment'),
  ('location_type','trail','Off-road/trail setting'),
  ('location_type','road','On-road cycling setting'),
  ('location_type','home','Home or indoor personal setting'),
  ('location_type','event','A race, event, or organized ride'),
  ('location_type','studio','A controlled/studio setting'),

  ('cta_type','follow_explicit','Directly asks the viewer to follow'),
  ('cta_type','comment_prompt','Asks the viewer to comment'),
  ('cta_type','save_prompt','Asks the viewer to save the post'),
  ('cta_type','share_prompt','Asks the viewer to share the post'),
  ('cta_type','link_bio','Points the viewer to the link in bio'),
  ('cta_type','none','No explicit call to action')
on conflict (dimension, value) do nothing;

-- ============================================================
-- Account rows. token_ref = the env var NAME, never the token.

insert into accounts (ig_user_id, handle, owner, page_id, token_ref) values
  ('17841403400545180', 'francisayling',  'francis', '1211240448749705', 'META_TOKEN_FRANCIS'),
  ('17841401067553376', 'baileyroseking', 'bailey',  '1334186459774678', 'META_TOKEN_BAILEY')
on conflict (ig_user_id) do update set
  handle    = excluded.handle,
  page_id   = excluded.page_id,
  token_ref = excluded.token_ref;
