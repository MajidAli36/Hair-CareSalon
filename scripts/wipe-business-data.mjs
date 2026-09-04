/**
 * Wipe all business data. KEEP: auth.users, organizations, organization_members (roles).
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadEnvLocal, getDatabaseUrl, getProjectRef, printDbEnvHelp } from "./load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlFile = resolve(__dirname, "../supabase/reset-business-data.sql");

const env = loadEnvLocal();
const dbUrl = getDatabaseUrl(env);
const ref = getProjectRef(env);

if (!dbUrl) {
  printDbEnvHelp();
  process.exit(1);
}

const parsed = new URL(dbUrl);
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
console.log("Connected — wiping business data (keeping org + login roles)…");
await client.query(readFileSync(sqlFile, "utf8"));

const { rows } = await client.query(`
  select
    (select count(*)::int from auth.users) as users,
    (select count(*)::int from public.organizations) as orgs,
    (select count(*)::int from public.organization_members) as members,
    (select count(*)::int from public.customers) as customers,
    (select count(*)::int from public.sales) as sales,
    (select count(*)::int from public.appointments) as appointments,
    (select count(*)::int from public.staff) as staff
`);
console.log("After wipe:", rows[0]);
await client.end();
console.log("✓ Done. Logins and roles kept.");
