import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import {
  listMedia,
  getMediaInsights,
  getAccountWindowTotals,
  metricsForType,
  isPreConversionError,
  GraphError,
} from "@/lib/graph-api";

/**
 * Nightly ingestion. Vercel Cron hits this route (protect it with a
 * CRON_SECRET check before going live — see docs/phase-1-prd.md §9).
 * Pulls both accounts; each account's token comes from its own Sensitive
 * env var, looked up via accounts.token_ref, never hardcoded here.
 */
export async function GET() {
  const supabase = getServiceClient();
  const { data: accounts, error } = await supabase.from("accounts").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const account of accounts ?? []) {
    const token = process.env[account.token_ref];
    if (!token) {
      results.push({ account: account.handle, error: `missing env var ${account.token_ref}` });
      continue;
    }
    results.push(await ingestAccount(supabase, account, token));
  }
  return NextResponse.json({ results });
}

async function ingestAccount(supabase: ReturnType<typeof getServiceClient>, account: any, token: string) {
  // 1. media list + upsert
  const items = await listMedia(account.ig_user_id, token);
  for (const it of items) {
    await supabase.from("media").upsert(
      {
        account_id: account.id,
        ig_media_id: it.id,
        media_type: it.media_type,
        media_product_type: it.media_product_type,
        permalink: it.permalink,
        caption: it.caption ?? "",
        posted_at: it.timestamp,
      },
      { onConflict: "ig_media_id" }
    );
  }

  // 2. per-media insights, skipping known pre-conversion posts
  const { data: skipRows } = await supabase
    .from("media")
    .select("ig_media_id")
    .eq("account_id", account.id)
    .eq("skip_reason", "pre_conversion");
  const skip = new Set((skipRows ?? []).map((r: any) => r.ig_media_id));

  let ok = 0, skipped = 0, failed = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const it of items) {
    if (skip.has(it.id)) {
      skipped++;
      continue;
    }
    const { data: mediaRow } = await supabase
      .from("media")
      .select("id")
      .eq("ig_media_id", it.id)
      .single();
    if (!mediaRow) continue;

    try {
      const metrics = await getMediaInsights(it.id, metricsForType(it.media_product_type, it.media_type), token);
      await supabase.from("media_metrics_daily").upsert(
        {
          media_id: mediaRow.id,
          date: today,
          reach: metrics.reach ?? null,
          views: metrics.views ?? null,
          likes: metrics.likes ?? null,
          comments: metrics.comments ?? null,
          saved: metrics.saved ?? null,
          shares: metrics.shares ?? null,
          total_interactions: metrics.total_interactions ?? null,
          avg_watch_time_s: metrics.ig_reels_avg_watch_time ?? null,
          reels_skip_rate: metrics.reels_skip_rate ?? null,
          // present only for FEED/STORY media — see metricsForType and
          // docs/phase-1-prd.md §2. Left null for REELS, not zero.
          profile_visits: metrics.profile_visits ?? null,
          follows: metrics.follows ?? null,
        },
        { onConflict: "media_id,date" }
      );
      ok++;
    } catch (e) {
      if (e instanceof GraphError && isPreConversionError(e)) {
        await supabase.from("media").update({ skip_reason: "pre_conversion" }).eq("id", mediaRow.id);
        skipped++;
      } else {
        failed++;
      }
    }
  }

  // 3. account-level daily totals (feeds the correlation model in the
  // Insight Engine — Phase 1 checkpoint 5, not implemented here yet)
  const totals = await getAccountWindowTotals(account.ig_user_id, token);
  await supabase.from("account_metrics_daily").upsert(
    { account_id: account.id, date: today, reach: totals.reach, follows: totals.follows, unfollows: totals.otherActions },
    { onConflict: "account_id,date" }
  );

  return { account: account.handle, media: items.length, ok, skipped, failed, accountTotals: totals };
}
