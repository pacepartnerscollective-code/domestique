#!/usr/bin/env node
/**
 * Run a read query against SUPABASE_DB_URL and print rows as JSON.
 *
 *   node --env-file=.env.local scripts/db-query.mjs "select handle from accounts"
 */
import pg from "pg";

const sql = process.argv[2];
if (!sql) {
  console.error('usage: node --env-file=.env.local scripts/db-query.mjs "<select ...>"');
  process.exit(1);
}
const client = new pg.Client({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
});
try {
  await client.connect();
  const r = await client.query(sql);
  console.log(JSON.stringify(r.rows, null, 2));
} finally {
  await client.end();
}
