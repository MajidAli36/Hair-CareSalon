/**
 * Apply sale lifecycle migration when direct db.* host is IPv6-only/unreachable.
 * Tries DATABASE_URL as-is, then session/transaction poolers across common regions.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadEnvLocal, getDatabaseUrl, getProjectRef } from "./load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationFile = resolve(
  __dirname,
  "../supabase/migrations/20250904100000_sale_lifecycle.sql"
);
const version = "20250904100000_sale_lifecycle.sql";

const REGIONS = [
  "ap-northeast-2",
  "ap-south-1",
  "ap-south-2",
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "eu-west-1",
  "eu-west-2",
  "eu-central-1",
  "eu-central-2",
  "us-east-1",
  "us-east-2",
  "us-west-1",
  "us-west-2",
  "sa-east-1",
  "ca-central-1",
];

function parseUrl(url) {
  const u = new URL(url);
  return {
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: (u.pathname.replace(/^\//, "") || "postgres").split("?")[0],
    host: u.hostname,
    port: Number(u.port || 5432),
  };
}

async function connect(config) {
  const client = new pg.Client({
    ...config,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  return client;
}

async function tryConfigs(configs) {
  let lastErr = null;
  for (const cfg of configs) {
    try {
      const client = await connect(cfg.config);
      console.log(`✓ Connected (${cfg.label})`);
      return client;
    } catch (e) {
      lastErr = e;
      const msg = String(e.message || e.code || e).slice(0, 120);
      console.log(`✗ ${cfg.label}: ${msg}`);
    }
  }
  throw lastErr ?? new Error("No database connection succeeded");
}

async function ensureTracking(client) {
  await client.query(`
    create table if not exists public.schema_migrations (
      version text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function alreadyApplied(client) {
  const { rows } = await client.query(
    `select 1 from public.schema_migrations where version = $1`,
    [version]
  );
  if (rows.length) return true;
  const { rows: t } = await client.query(`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'sale_versions'
    ) as ok
  `);
  return Boolean(t[0]?.ok);
}

const env = loadEnvLocal();
const dbUrl = getDatabaseUrl(env);
if (!dbUrl) {
  console.error("Missing DATABASE_URL / SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const parsed = parseUrl(dbUrl);
const ref = getProjectRef(env);
const poolUser = parsed.user.includes(".") ? parsed.user : `postgres.${ref}`;

const configs = [
  { label: `configured ${parsed.host}:${parsed.port}`, config: { ...parsed } },
];

for (const region of REGIONS) {
  for (const port of [6543, 5432]) {
    configs.push({
      label: `pooler ${region}:${port}`,
      config: {
        host: `aws-0-${region}.pooler.supabase.com`,
        port,
        user: poolUser,
        password: parsed.password,
        database: parsed.database,
      },
    });
  }
}

console.log(`Applying ${version} for project ${ref}…\n`);

let client;
try {
  client = await tryConfigs(configs);
} catch (e) {
  console.error("\nCould not connect to Postgres from this machine.");
  console.error("Your db.* host is likely IPv6-only; this network has no IPv6 route.");
  console.error("\nFix: Supabase Dashboard → Project → SQL Editor → New query.");
  console.error("Paste and run: supabase/migrations/20250904100000_sale_lifecycle.sql");
  console.error("\nThen update .env.local DATABASE_URL to the Session pooler URI");
  console.error("(Dashboard → Connect → Connection string → Session mode).\n");
  process.exit(1);
}

try {
  await ensureTracking(client);
  if (await alreadyApplied(client)) {
    console.log("Already applied (sale_versions present). Refreshing schema is enough.");
    console.log("In Supabase Dashboard → Settings → API → Reload schema if needed.");
    process.exit(0);
  }

  const sql = readFileSync(migrationFile, "utf8");
  // Do not wrap in an explicit transaction: ALTER TYPE … ADD VALUE is safer outside one.
  await client.query(sql);
  await client.query(
    `insert into public.schema_migrations (version) values ($1) on conflict do nothing`,
    [version]
  );

  const { rows } = await client.query(`
    select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = 'sale_versions'
    ) as ok
  `);
  if (!rows[0]?.ok) throw new Error("Migration ran but sale_versions still missing");

  console.log("\n✓ sale_versions / sale_refunds migration applied successfully.");
  console.log("Retry Save amendment in the app.\n");
} finally {
  await client.end();
}
