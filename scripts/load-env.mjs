import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const root = resolve(__dirname, "..");

/** Free-tier direct DB hosts are often IPv6-only; Node on Windows may fail with ENOTFOUND. */
const DEFAULT_POOLER_REGION = "ap-southeast-1";

/** Try these when SUPABASE_DB_REGION is not set (order = most likely for this project first). */
const POOLER_REGION_FALLBACKS = [
  "ap-southeast-1",
  "ap-south-1",
  "ap-northeast-1",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "us-east-1",
  "us-west-1",
];

export function loadEnvLocal() {
  const path = resolve(root, ".env.local");
  if (!existsSync(path)) return {};
  const content = readFileSync(path, "utf8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

export function getProjectRef(env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match?.[1] ?? "demxgsbuppklniszfqvw";
}

function getPoolerRegion(env) {
  return (
    env.SUPABASE_DB_REGION?.trim() ||
    env.DATABASE_REGION?.trim() ||
    DEFAULT_POOLER_REGION
  );
}

/**
 * Convert a direct db.<ref>.supabase.co URL to the IPv4 pooler URL.
 * Pooler username must be postgres.<project-ref>.
 */
export function toPoolerDatabaseUrl(connectionString, env = {}) {
  if (!connectionString) return null;
  if (/pooler\.supabase\.com/i.test(connectionString)) return connectionString;

  const direct = connectionString.match(
    /postgresql:\/\/([^:]+):([^@]+)@db\.([^.]+)\.supabase\.co(?::\d+)?\/(.+)/i
  );
  if (!direct) return connectionString;

  const [, user, password, ref, database] = direct;
  const region = getPoolerRegion(env);
  const poolerUser = user.includes(".") ? user : `postgres.${ref}`;
  return `postgresql://${poolerUser}:${password}@aws-0-${region}.pooler.supabase.com:6543/${database}`;
}

/** Candidate URLs to try (pooler first, then original). */
export function getDatabaseUrlCandidates(env) {
  const candidates = [];
  const seen = new Set();

  function add(url) {
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidates.push(url);
  }

  if (env.DATABASE_POOLER_URL) add(env.DATABASE_POOLER_URL);

  const preferredRegion = env.SUPABASE_DB_REGION?.trim() || env.DATABASE_REGION?.trim();
  const regions = preferredRegion
    ? [preferredRegion, ...POOLER_REGION_FALLBACKS.filter((r) => r !== preferredRegion)]
    : POOLER_REGION_FALLBACKS;

  if (env.DATABASE_URL) {
    if (/pooler\.supabase\.com/i.test(env.DATABASE_URL)) {
      add(env.DATABASE_URL);
    } else {
      // Prefer original direct URL first — run-sql resolves AAAA for IPv6-only hosts
      add(env.DATABASE_URL);
    for (const region of regions) {
      add(toPoolerDatabaseUrl(env.DATABASE_URL, { ...env, SUPABASE_DB_REGION: region }));
      // Some projects accept plain postgres user on pooler
      try {
        const u = new URL(env.DATABASE_URL);
        const password = u.password;
        const database = u.pathname.replace(/^\//, "") || "postgres";
        add(
          `postgresql://postgres:${password}@aws-0-${region}.pooler.supabase.com:6543/${database}`
        );
        add(
          `postgresql://postgres:${password}@aws-0-${region}.pooler.supabase.com:5432/${database}`
        );
      } catch {
        // ignore bad URL
      }
    }
    }
  }

  const password = env.SUPABASE_DB_PASSWORD;
  if (password) {
    const ref = getProjectRef(env);
    const encoded = encodeURIComponent(password);
    // Direct host first (IPv6 via resolve6 in run-sql)
    add(`postgresql://postgres:${encoded}@db.${ref}.supabase.co:5432/postgres`);
    for (const region of regions) {
      add(
        `postgresql://postgres.${ref}:${encoded}@aws-0-${region}.pooler.supabase.com:5432/postgres`
      );
      add(
        `postgresql://postgres.${ref}:${encoded}@aws-0-${region}.pooler.supabase.com:6543/postgres`
      );
    }
  }

  return candidates;
}

/** Direct Postgres URL for migrations (DATABASE_URL or built from DB password). */
export function getDatabaseUrl(env) {
  return getDatabaseUrlCandidates(env)[0] ?? null;
}

export function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, ...opts });
}

export function printDbEnvHelp() {
  console.error("\nAdd ONE of these to .env.local:\n");
  console.error("  Option 1 — Session/Transaction pooler URL (recommended on Windows):");
  console.error("    Supabase Dashboard → Connect → Connection string → Pooler");
  console.error(
    "    DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres\n"
  );
  console.error("  Option 2 — database password only (+ optional region):");
  console.error("    SUPABASE_DB_PASSWORD=your-database-password");
  console.error("    SUPABASE_DB_REGION=ap-southeast-1\n");
  console.error(
    "  Note: db.<ref>.supabase.co is often IPv6-only and fails with ENOTFOUND in Node.\n"
  );
}
