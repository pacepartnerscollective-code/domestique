# Domestique

Internal tooling for Peace Partners Collective — the support work behind the content: analytics, research, ideation, hooks, and brand outreach.

- **Design & architecture:** [Domestique](https://claude.ai/code/artifact/46df7de6-2713-4763-97ac-6662554785bb) — the full brief (two loops, panel structure, security posture, roadmap).
- **Phase 1 spec:** [Domestique Phase 1](https://claude.ai/code/artifact/17879ee4-b7e2-4295-8710-431b67193c6b), mirrored and kept current at [`docs/phase-1-prd.md`](docs/phase-1-prd.md).

## Stack

Next.js (App Router) + Supabase (Postgres, auth, RLS) + Vercel (hosting, Cron). One repo — no monorepo needed at this scale.

## Status

Phase 1, checkpoint 0 (scaffold). See `docs/phase-1-prd.md` §10 for the build order — ingestion (`app/api/cron/ingest`) is written and ported from the validated existing pipeline; tagging, insight, and digest are stubbed with their exact spec, not yet implemented.

## Setup

1. Copy `.env.example` to `.env.local` for local dev. In Vercel, every one of those variables must be set as **Sensitive**, not regular — see `docs/phase-1-prd.md` §9.
2. Apply the migrations in `supabase/migrations/` to a Supabase project (replace the placeholder RLS emails in `0001_phase1_schema.sql` first).
3. `npm install && npm run dev`.

## Repo layout

```
app/api/cron/     -- ingest (done) · tag · insight · digest (all TODO, see file headers)
lib/              -- graph-api.ts (ported from the old pull.py/graph.py), supabase.ts, gmail.ts
supabase/         -- migrations (schema + taxonomy seed)
docs/             -- the Phase 1 PRD, kept accurate to what's actually built
```
