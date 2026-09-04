import { NextResponse } from "next/server";

/**
 * Checkpoint 6 (docs/phase-1-prd.md §10) — not yet implemented.
 *
 * Weekly, after insight/route.ts has run: build the digest payload (this
 * week's reach->profile-visit rate vs. baseline, top insights with their
 * n/evidence, "not this week" placeholder for Ideas/Outreach — see the
 * copy rules and mockup in docs/phase-1-prd.md §8), write a `digests` row,
 * then sendDigest() from lib/gmail.ts to both inboxes.
 *
 * First run: dry-run to Francis alone (per the build order), confirm the
 * numbers match reports/audit_<date>.md from the existing pipeline before
 * sending to both.
 */
export async function GET() {
  return NextResponse.json({ status: "not implemented", checkpoint: 6 });
}
