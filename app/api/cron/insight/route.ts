import { NextResponse } from "next/server";

/**
 * Checkpoint 5 (docs/phase-1-prd.md §10) — not yet implemented.
 *
 * Weekly, after tag/route.ts has run:
 *   1. Compute benchmarks (p50/p90) per scope — 'account:<handle>',
 *      'format:reels', 'hook_modality:<value>' — over a rolling window.
 *      Include sv_per_k (1000*(saved+shares)/reach) and engagement rate
 *      (total_interactions/reach) — same derived metrics the existing
 *      report.py already uses, for continuity with the known-good numbers.
 *   2. Correlation model: account_metrics_daily.follows vs. per-Reel
 *      reach from media_metrics_daily, lagged — NOT a per-post follows
 *      column, which Reels don't expose (docs/phase-1-prd.md §2).
 *   3. Write `insights` rows: every claim needs n, effect_size, evidence
 *      media IDs, and a status of 'confirmed' or 'emerging'. No claim
 *      ships without evidence — see the anti-slop rules in the main brief.
 */
export async function GET() {
  return NextResponse.json({ status: "not implemented", checkpoint: 5 });
}
