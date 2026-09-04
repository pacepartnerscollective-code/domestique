/**
 * Instagram Graph API client. Ported from the validated Python pipeline
 * (graph.py / pull.py / config.py in the Instagram Auditor project) —
 * same retry codes, same per-media-type metric sets, same account-level
 * formula for the reach->profile-visit rate. See docs/phase-1-prd.md §2-3.
 */

const GRAPH_VERSION = process.env.GRAPH_VERSION ?? "v23.0";
const BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Graph error codes worth retrying (rate limits + transient), same set the
// existing pipeline uses.
const RETRY_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);

export class GraphError extends Error {
  code?: number;
  subcode?: number;
  path?: string;
  constructor(message: string, code?: number, subcode?: number, path?: string) {
    super(message);
    this.name = "GraphError";
    this.code = code;
    this.subcode = subcode;
    this.path = path;
  }
}

export async function graphGet<T = any>(
  path: string,
  params: Record<string, string> = {},
  token: string,
  retries = 5
): Promise<T> {
  const url = new URL(`${BASE}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);

  let lastErr = "";
  for (let attempt = 0; attempt < retries; attempt++) {
    let res: Response;
    try {
      res = await fetch(url.toString(), { signal: AbortSignal.timeout(45_000) });
    } catch (e) {
      lastErr = String(e);
      await sleep(5_000 * 2 ** attempt);
      continue;
    }
    if (res.ok) return (await res.json()) as T;

    let err: any = {};
    try {
      err = (await res.json())?.error ?? {};
    } catch {
      /* non-JSON error body */
    }
    const code = err.code;
    if (res.status >= 500 || RETRY_CODES.has(code)) {
      lastErr = `${code}: ${err.message}`;
      await sleep(5_000 * 2 ** attempt);
      continue;
    }
    throw new GraphError(err.message ?? (await res.text()), code, err.error_subcode, path);
  }
  throw new GraphError(`exhausted retries (${lastErr})`, undefined, undefined, path);
}

export async function graphPaginate<T = any>(
  path: string,
  params: Record<string, string>,
  token: string,
  maxPages = 200
): Promise<T[]> {
  const out: T[] = [];
  let page = await graphGet<{ data: T[]; paging?: { next?: string } }>(path, params, token);
  out.push(...(page.data ?? []));
  let n = 1;
  while (page.paging?.next && n < maxPages) {
    const res = await fetch(page.paging.next, { signal: AbortSignal.timeout(45_000) });
    page = await res.json();
    if ((page as any).error) {
      throw new GraphError((page as any).error.message, (page as any).error.code);
    }
    out.push(...(page.data ?? []));
    n++;
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------- media
export type MediaProductType = "FEED" | "REELS" | "STORY" | "AD";
export type MediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

// Per-media-type metric sets — validated against the live API. Reels do NOT
// support profile_visits / follows; only Feed (IMAGE_MEDIA_METRICS) does.
// Confirmed empirically (docs/phase-1-prd.md §2) — do not add them to the
// Reels set on the assumption the docs are wrong.
export const REEL_MEDIA_METRICS = [
  "reach", "saved", "shares", "likes", "comments", "total_interactions",
  "views", "ig_reels_avg_watch_time", "ig_reels_video_view_total_time",
];
export const IMAGE_MEDIA_METRICS = [
  "reach", "saved", "shares", "likes", "comments", "total_interactions",
  "views", "profile_visits", "follows",
];
export const CAROUSEL_MEDIA_METRICS = [
  "reach", "saved", "shares", "likes", "comments", "total_interactions", "views",
];

export function metricsForType(mediaProductType?: string, mediaType?: string): string[] {
  const t = mediaProductType || mediaType;
  if (t === "REELS" || t === "VIDEO") return REEL_MEDIA_METRICS;
  if (t === "IMAGE" || t === "FEED") return IMAGE_MEDIA_METRICS;
  return CAROUSEL_MEDIA_METRICS;
}

export interface IgMedia {
  id: string;
  caption?: string;
  media_type: MediaType;
  media_product_type: MediaProductType;
  timestamp: string;
  permalink?: string;
}

export async function listMedia(igUserId: string, token: string): Promise<IgMedia[]> {
  return graphPaginate<IgMedia>(
    `${igUserId}/media`,
    { fields: "id,caption,media_type,media_product_type,timestamp,permalink", limit: "100" },
    token
  );
}

/** Per-media insights. Callers must catch GraphError and check for the
 * pre-conversion signature (subcode 2108006, or "before" in the message) —
 * that means the post predates the business-account conversion and should
 * be permanently skipped (media.skip_reason = 'pre_conversion'), not retried. */
export async function getMediaInsights(
  mediaId: string,
  metrics: string[],
  token: string
): Promise<Record<string, number>> {
  const res = await graphGet<{ data: Array<{ name: string; values: Array<{ value: any }> }> }>(
    `${mediaId}/insights`,
    { metric: metrics.join(",") },
    token
  );
  const out: Record<string, number> = {};
  for (const m of res.data ?? []) {
    let v = m.values?.[0]?.value ?? 0;
    if (v && typeof v === "object") v = Object.values(v).reduce((a: number, b: any) => a + b, 0);
    out[m.name] = v as number;
  }
  return out;
}

export function isPreConversionError(err: GraphError): boolean {
  return err.subcode === 2108006 || /before/i.test(err.message);
}

// ---------------------------------------------------------------- account
/**
 * The account-level 30-day totals behind the reach->profile-visit rate.
 * Formula, ported exactly from the validated pipeline (report.py):
 *
 *   reachToProfileVisit = profile_views / reach_non_follower
 *
 * profile_views is an unsplit 30-day total (not broken down by visitor
 * follow-status) — this is an approximation against the non-follower-reach
 * denominator, not a precise "visits from non-followers" count. Report it
 * with that caveat, exactly as the existing digest/report already does.
 */
export async function getAccountWindowTotals(igUserId: string, token: string, sinceDays = 30) {
  const since = unixDaysAgo(sinceDays);
  const until = unixDaysAgo(0);

  const totals = await graphGet<{ data: Array<{ name: string; total_value: { value: number } }> }>(
    `${igUserId}/insights`,
    {
      metric: "reach,profile_views,accounts_engaged,total_interactions,likes,comments,saves,shares,views",
      period: "day",
      metric_type: "total_value",
      since: String(since),
      until: String(until),
    },
    token
  );
  const flat: Record<string, number> = {};
  for (const m of totals.data ?? []) flat[m.name] = m.total_value?.value ?? 0;

  const reachSplit = await graphGet<{
    data: Array<{ total_value: { breakdowns: Array<{ results: Array<{ dimension_values: string[]; value: number }> }> } }>;
  }>(
    `${igUserId}/insights`,
    { metric: "reach", period: "day", metric_type: "total_value", breakdown: "follow_type", since: String(since), until: String(until) },
    token
  );
  const reachByFollowType: Record<string, number> = {};
  for (const m of reachSplit.data ?? []) {
    for (const bd of m.total_value?.breakdowns ?? []) {
      for (const r of bd.results ?? []) reachByFollowType[r.dimension_values[0]] = r.value ?? 0;
    }
  }

  const followsSplit = await graphGet<{
    data: Array<{ total_value: { breakdowns: Array<{ results: Array<{ dimension_values: string[]; value: number }> }> } }>;
  }>(
    `${igUserId}/insights`,
    { metric: "follows_and_unfollows", period: "day", metric_type: "total_value", breakdown: "follow_type", since: String(since), until: String(until) },
    token
  );
  const followsByType: Record<string, number> = {};
  for (const m of followsSplit.data ?? []) {
    for (const bd of m.total_value?.breakdowns ?? []) {
      for (const r of bd.results ?? []) followsByType[r.dimension_values[0]] = r.value ?? 0;
    }
  }

  const reachNonFollower = reachByFollowType["NON_FOLLOWER"] ?? 0;
  const profileViews = flat["profile_views"] ?? 0;
  // NB: dimension naming here is the existing pipeline's empirically-found
  // convention (FOLLOWER = the 30d new-follows count, NON_FOLLOWER = the
  // other bucket) — preserved as-is rather than re-derived from Meta's own
  // (confusingly named) breakdown values.
  const follows = followsByType["FOLLOWER"] ?? 0;

  return {
    reach: flat["reach"] ?? 0,
    reachFollower: reachByFollowType["FOLLOWER"] ?? 0,
    reachNonFollower,
    profileViews,
    follows,
    otherActions: followsByType["NON_FOLLOWER"] ?? 0,
    reachToProfileVisitRate: reachNonFollower ? profileViews / reachNonFollower : 0,
    profileVisitToFollowRate: profileViews ? follows / profileViews : 0,
  };
}

function unixDaysAgo(days: number): number {
  return Math.floor(Date.now() / 1000) - days * 86400;
}
