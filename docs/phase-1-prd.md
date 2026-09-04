# Domestique — Phase 1 PRD

Full design rationale lives in two published briefs: [Domestique](https://claude.ai/code/artifact/46df7de6-2713-4763-97ac-6662554785bb) (architecture, security, roadmap) and [Domestique Phase 1](https://claude.ai/code/artifact/17879ee4-b7e2-4295-8710-431b67193c6b) (this document's original form). This file is the local, code-adjacent mirror — kept accurate to what's actually implemented, corrected against ground truth found while porting the existing pipeline.

## 0. What's already true

A working Python pipeline (`pull.py` / `report.py` / `graph.py` / `db.py`, in the separate `Instagram Auditor - Ideation` project folder) already produced the diagnosis this project is built around, and already validated the hard parts. This repo ports its logic into Supabase/Next.js/Vercel and extends it to Bailey — it is not a rewrite from first principles.

- Francis's IG Business Account: `17841403400545180` (@francisayling)
- Meta app "Content Auditor and Assistant", Development mode, Business type
- Page "PAA" (`1211240448749705`) satisfies the Graph API's Page-connection requirement
- Graph API version in use: `v23.0`
- History limit: posts before the ~Mar 2026 personal→business conversion return no insights. 33 of 84 API-visible posts are skipped (`skip_reason = 'pre_conversion'`); 51 analyzable Reels remain; lifetime `media_count` 161.
- Confirmed diagnosis (2026-09-02): 30-day reach 445,379; non-follower reach 443,974 (99.68%); profile views 4,180; reach→profile-visit **0.94%**; profile-visit→follow **18.5%**; 774 30-day follows.

Superseded, not ported: the old `COMPETITORS` env var / basic competitor pull. Replaced by the niche + format panel structure in the main brief's Phase 2.

## 1. Scope

**In Phase 1:** nightly ingestion for both accounts, the 12-dimension tagging taxonomy applied to our own posts, ASR+OCR feeding that tagging, first-party cohort/retention analysis, evidence-backed insights, weekly email digest.

**Not in Phase 1:** Research Service / panels, Ideator, Hook Scorer, dashboard UI, Outreach Engine, hypothesis ledger, anything cross-niche or cross-platform.

## 2. Metrics & attribution model — corrected against ground truth

Two different claims, two different methods:

**Account-level, weekly — directly measurable and confirmed working.** The existing pipeline pulls `profile_views` at the account level (30-day `metric_type=total_value` window) and it returned real data on 2026-09-02. An earlier draft of this PRD flagged this metric as possibly deprecated based on web research — that caution was wrong for this account; ground truth from the actual pipeline overrides it. Keep requesting it.

Exact formula, ported as-is (see `lib/graph-api.ts`):

```
reachToProfileVisitRate = profile_views (30d total, unsplit)
                         / reach_non_follower (30d, via reach metric,
                           metric_type=total_value, breakdown=follow_type)
```

Note this is an approximation, not a precise "visits from non-followers" count — `profile_views` itself isn't broken down by the visitor's follow status. Report it with that caveat, exactly as the existing digest already does.

**Per-post — not directly measurable for Reels, confirmed empirically twice** (independently, by the existing pipeline's field configuration and by Meta's own docs): Reels do not return `profile_visits` or `follows` from `/{media-id}/insights`. Only `FEED`/`IMAGE` media types do. Approximate per-post attribution by correlating `account_metrics_daily.follows` against per-Reel reach in `media_metrics_daily`, lagged — never state it as a direct count.

`follows_and_unfollows` breakdown convention (preserve as-is, don't re-derive): dimension value `FOLLOWER` = the 30-day new-follows count; `NON_FOLLOWER` = the other bucket. This is what the existing pipeline empirically found works and matches expected magnitudes — not necessarily Meta's most intuitive naming, but don't "fix" it without re-validating against real numbers first.

## 3. Confirmed Graph API fields

**IG Media object:** `id, caption, media_type, media_product_type, timestamp, permalink` (list); `media_url, thumbnail_url, like_count, comments_count, media_audio_type` available but not yet pulled in Phase 1.

**Per-media insights, by `media_product_type`** (see `lib/graph-api.ts` — `REEL_MEDIA_METRICS` / `IMAGE_MEDIA_METRICS` / `CAROUSEL_MEDIA_METRICS`, validated against the live API):

| Type | Metrics |
|---|---|
| REELS / VIDEO | `reach, saved, shares, likes, comments, total_interactions, views, ig_reels_avg_watch_time, ig_reels_video_view_total_time` |
| IMAGE / FEED | `reach, saved, shares, likes, comments, total_interactions, views, profile_visits, follows` |
| CAROUSEL_ALBUM (fallback) | `reach, saved, shares, likes, comments, total_interactions, views` |

**Account-level insights** (`/{ig-user-id}/insights`): `reach, profile_views, accounts_engaged, total_interactions, likes, comments, saves, shares, views` (30d window total) + `reach` and `follows_and_unfollows` each with `breakdown=follow_type`.

**Retry codes** (transient/rate-limit, worth retrying with backoff): `1, 2, 4, 17, 32, 341, 613`. Pre-conversion signature to catch and permanently skip, not retry: `error_subcode === 2108006` or `"before"` in the error message.

## 4. Tagging taxonomy

12 dimensions, seeded in `supabase/migrations/0002_phase1_taxonomy_seed.sql`: `hook_modality, hook_type, topic (open vocabulary), format, length_bucket, pacing_cuts_per_10s (raw int), audio_type, onscreen_text_density, first_frame_kind, bailey_appears (bool), location_type, cta_type`. Full enum values and one-line definitions are in that seed file — it's the source of truth, not this doc.

## 5. Architecture

```
nightly:  Graph API (both accounts) -> media, media_metrics_daily,
          account_metrics_daily         [app/api/cron/ingest — implemented]
          new media -> ASR + OCR -> tagging LLM call -> tags
                                                          [cron/tag — TODO]
weekly:   media + tags + metrics -> benchmarks (incl. sv_per_k =
          1000*(saved+shares)/reach, matching the existing report.py)
                                  -> correlation model
                                  -> insights (n, effect_size, evidence)
                                                       [cron/insight — TODO]
                                  -> digest payload -> Gmail API -> both
                                                        [cron/digest — TODO]
```

## 6. Database

See `supabase/migrations/0001_phase1_schema.sql` (schema, RLS) and `0002_phase1_taxonomy_seed.sql` (taxonomy rows). Eight tables: `accounts, media, media_metrics_daily, account_metrics_daily, taxonomy, tags, benchmarks, insights, digests`. No `external_media`/`watch_list`/`hypotheses` yet — Phase 2's job.

**Before applying migration 0001 for real:** replace the placeholder emails in its RLS policy (`REPLACE_WITH_FRANCIS_EMAIL`, `REPLACE_WITH_BAILEY_EMAIL`) with actual Supabase auth emails.

## 7. Acceptance criteria

- **Ingestion** (`app/api/cron/ingest`, implemented): idempotent re-runs; pre-conversion media flagged not dropped; 30-day reach and follower count match `reports/audit_2026-09-02.md` within rounding before this replaces the old pipeline.
- **Tagging** (TODO): all 51 analyzable Reels backfilled, all 12 dimensions; new media tagged within 24h; every tag traceable to its transcript/OCR/thumbnail source.
- **Insight Engine** (TODO): every insight carries `n`, `effect_size`, evidence media IDs; below-threshold claims marked `emerging`; no fabricated per-Reel profile-visit numbers.
- **Digest** (TODO): sends every Monday via Gmail API to both inboxes; failed sends retry and alert, never fail silently.

## 8. Digest — copy rules

Every derived number states its `n` or window inline. "Correlating with," never "caused." No Ideas/Hooks/Outreach section — those features don't exist yet, so the digest shouldn't imply they do. Full mockup in the [Phase 1 artifact](https://claude.ai/code/artifact/17879ee4-b7e2-4295-8710-431b67193c6b) §8.

## 9. Security checklist

- Every credential (`META_TOKEN_FRANCIS`, `META_TOKEN_BAILEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GMAIL_CLIENT_SECRET`, refresh tokens) set as a Vercel **Sensitive** environment variable — see `.env.example` for the full list of names. Never a regular env var.
- RLS enabled on all eight tables from migration 0001 — before any real data lands.
- Vercel Deployment Protection (Standard) + MFA on the Vercel account.
- Cron routes should check a `CRON_SECRET` header before doing anything — not yet added to the route stubs, add before deploying.
- Service-role key used only in `lib/supabase.ts`, server-side, never imported into a client component.

## 10. Build order

0. ~~Repo scaffolded~~ — done (this commit)
1. Bailey connects — her own Page + IG professional account, authorized into the existing Meta app. **Blocks nothing else in this repo yet, but blocks running ingestion for her account.**
2. Provision Supabase: apply both migrations, set RLS policy emails for real, set every Sensitive env var in Vercel.
3. Validate ingestion (`app/api/cron/ingest`, already written) against `reports/audit_2026-09-02.md` before trusting it.
4. Build tagging (`app/api/cron/tag`) — pick an ASR/OCR vendor, backfill 51 Reels.
5. Build the Insight Engine (`app/api/cron/insight`).
6. Build the digest (`app/api/cron/digest`) — dry run to Francis alone first.
7. Retire the old Python pipeline once three consecutive weeks of parity are confirmed.

## 11. Open, verify-at-build-time

- Two-token setup in the old pipeline (`IG_USER_TOKEN` vs `IG_PAGE_TOKEN`) — the debug/expiry check uses a separate token from the one used for data calls. Confirm which one(s) Bailey's setup actually needs before assuming a single token per account is enough.
- ASR/OCR vendor choice — not yet picked; cost is negligible at this volume (see the main brief's Security section math), so pick on quality/DX, not price.
- Cron route auth (`CRON_SECRET`) — not yet implemented in the stubs above, needed before any of this is deployed publicly.
