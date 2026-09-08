#!/usr/bin/env node
/**
 * Inspect a Meta token's type, validity, and expiry.
 *
 *   node --env-file=.env.local scripts/check-token.mjs META_TOKEN_BAILEY
 */
const name = process.argv[2] || "META_TOKEN_BAILEY";
const token = process.env[name];
if (!token) {
  console.error(`${name} not set`);
  process.exit(1);
}
const app = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
const u = `https://graph.facebook.com/v23.0/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(app)}`;
const r = await fetch(u).then((x) => x.json());
const d = r.data ?? {};
const iso = (s) => (s === 0 ? "never" : s ? new Date(s * 1000).toISOString() : null);
console.log(
  JSON.stringify(
    {
      name,
      type: d.type,
      valid: d.is_valid,
      app_id: d.app_id,
      profile_id: d.profile_id,
      expires_at: iso(d.expires_at),
      data_access_expires_at: iso(d.data_access_expires_at),
      scopes: d.scopes,
      error: r.error ?? d.error,
    },
    null,
    2
  )
);
