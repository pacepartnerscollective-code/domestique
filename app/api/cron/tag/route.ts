import { NextResponse } from "next/server";

/**
 * Checkpoint 4 (docs/phase-1-prd.md §10) — not yet implemented.
 *
 * For each media row with no tags yet:
 *   1. ASR the video at media.permalink/media_url -> media.transcript
 *   2. OCR sampled frames -> media.ocr_text
 *   3. One LLM call per media, given caption + transcript + ocr_text +
 *      thumbnail, tagging all 12 dimensions in docs/phase-1-prd.md §4
 *      against the seeded `taxonomy` table -> insert into `tags`
 *
 * Backfill target: all 51 analyzable Reels once, then run nightly on new
 * media only. ASR/OCR vendor is an open pick at build time (Whisper-tier
 * pricing confirmed cheap at this volume in the main brief's Security
 * section discussion — not a budget-gating decision).
 */
export async function GET() {
  return NextResponse.json({ status: "not implemented", checkpoint: 4 });
}
