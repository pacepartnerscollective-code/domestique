#!/usr/bin/env node
/**
 * Run a .sql file against the database in SUPABASE_DB_URL.
 *
 *   node --env-file=.env.local scripts/apply-sql.mjs <path-to.sql>
 *
 * Used for first-time setup / ad-hoc migration application. The connection
 * string is a secret — this script never prints it.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const sqlPath = process.argv[2];
if (!sqlPath) {
  console.error("usage: node --env-file=.env.local scripts/apply-sql.mjs <path-to.sql>");
  process.exit(1);
}
const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL not set (did you pass --env-file=.env.local?)");
  process.exit(1);
}

const sql = readFileSync(sqlPath, "utf8");
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.error(`applied ${sqlPath}`);
} catch (e) {
  console.error(`failed: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
