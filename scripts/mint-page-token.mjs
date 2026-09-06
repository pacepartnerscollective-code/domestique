#!/usr/bin/env node
/**
 * Mint a long-lived (effectively non-expiring) Instagram Graph API Page
 * access token. Replaces the old pipeline's scripts/refresh_token.py, but
 * never writes the token to disk — you copy it into the matching Vercel
 * *Sensitive* env var yourself (docs/phase-1-prd.md §9).
 *
 * Usage:
 *   node scripts/mint-page-token.mjs <PAGE_ID> <SHORT_LIVED_USER_TOKEN>
 *
 * With META_APP_ID + META_APP_SECRET in the environment, it first
 * exchanges the short-lived user token (from the Graph API Explorer) for a
 * 60-day long-lived user token, then derives the Page token — which does
 * not expire while that user token stays valid. Without the app secret,
 * pass a token you've already extended at
 * developers.facebook.com/tools/debug/accesstoken and it skips that step.
 *
 * The Page token is printed to stdout; diagnostics go to stderr, so
 * `node scripts/mint-page-token.mjs ... 2>/dev/null` gives you just the token.
 *
 *   Francis: PAGE_ID 1211240448749705  (Page "PAA")
 *   Bailey:  PAGE_ID 1334186459774678  (Page "BPAA")
 */
const GRAPH = `https://graph.facebook.com/${process.env.GRAPH_VERSION ?? "v23.0"}`;

const [pageId, userTokenArg] = process.argv.slice(2);
if (!pageId || !userTokenArg) {
  console.error("usage: node scripts/mint-page-token.mjs <PAGE_ID> <SHORT_LIVED_USER_TOKEN>");
  process.exit(1);
}

let userToken = userTokenArg.trim();
const appId = process.env.META_APP_ID;
const appSecret = process.env.META_APP_SECRET;

if (appId && appSecret) {
  const u = new URL(`${GRAPH}/oauth/access_token`);
  u.searchParams.set("grant_type", "fb_exchange_token");
  u.searchParams.set("client_id", appId);
  u.searchParams.set("client_secret", appSecret);
  u.searchParams.set("fb_exchange_token", userToken);
  const r = await fetch(u).then((x) => x.json());
  if (!r.access_token) {
    console.error("long-lived user token exchange failed:", r);
    process.exit(1);
  }
  userToken = r.access_token;
  console.error("- exchanged for a long-lived user token");
} else {
  console.error("- META_APP_ID/META_APP_SECRET not set; assuming the token passed is already extended");
}

const p = new URL(`${GRAPH}/${pageId}`);
p.searchParams.set("fields", "access_token");
p.searchParams.set("access_token", userToken);
const pr = await fetch(p).then((x) => x.json());
if (!pr.access_token) {
  console.error("could not derive page token:", pr);
  process.exit(1);
}

const d = new URL(`${GRAPH}/debug_token`);
d.searchParams.set("input_token", pr.access_token);
d.searchParams.set("access_token", userToken);
const dbg = await fetch(d)
  .then((x) => x.json())
  .then((x) => x.data ?? {});
console.error(
  `- page token: valid=${dbg.is_valid} expires_at=${dbg.expires_at ?? "never"} ` +
    `data_access_expires_at=${dbg.data_access_expires_at ?? "n/a"}`
);
console.error("- copy the line below into the matching Vercel Sensitive env var\n");

console.log(pr.access_token);
