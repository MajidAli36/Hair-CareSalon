/**
 * Apply sales.staff_id migration (IPv4 pooler fallback).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadEnvLocal, getDatabaseUrl, getProjectRef } from "./load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationFile = resolve(
  __dirname,
  "../supabase/migrations/20250904130000_sale_staff.sql"
);
const version = "20250904130000_sale_staff.sql";

const env = loadEnvLocal();
const parsed = new URL(getDatabaseUrl(env));
const ref = getProjectRef(env);
const password = decodeURIComponent(parsed.password);
const poolUser = parsed.username.includes(".")
  ? decodeURIComponent(parsed.username)
  : `postgres.${ref}`;

const client = new pg.Client({
  host: parsed.hostname.includes("pooler")
    ? parsed.hostname
    : "aws-0-ap-northeast-2.pooler.supabase.com",
  port: parsed.hostname.includes("pooler") ? Number(parsed.port || 6543) : 6543,
  user: poolUser,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log("Connected");

await client.query(`
  create table if not exists public.schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  );
`);

const { rows } = await client.query(
  `select 1 from public.schema_migrations where version = $1`,
  [version]
);
if (rows.length) {
  console.log("Already applied");
  await client.end();
  process.exit(0);
}

const sql = readFileSync(migrationFile, "utf8");
await client.query(sql);
await client.query(
  `insert into public.schema_migrations (version) values ($1) on conflict do nothing`,
  [version]
);
await client.query("notify pgrst, 'reload schema'");
console.log("✓ Applied", version);
await client.end();
