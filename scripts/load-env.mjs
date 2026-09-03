import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const root = resolve(__dirname, "..");

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

/** Direct Postgres URL for migrations (DATABASE_URL or built from DB password). */
export function getDatabaseUrl(env) {
  if (env.DATABASE_URL) return env.DATABASE_URL;

  const password = env.SUPABASE_DB_PASSWORD;
  if (!password) return null;

  const ref = getProjectRef(env);
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

export function run(cmd, opts = {}) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: "inherit", cwd: root, ...opts });
}

export function printDbEnvHelp() {
  console.error("\nAdd ONE of these to .env.local:\n");
  console.error("  Option 1 — DATABASE_URL (easiest, copy from Supabase Dashboard → Connect):");
  console.error("    DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-....pooler.supabase.com:6543/postgres\n");
  console.error("  Option 2 — database password only:");
  console.error("    SUPABASE_DB_PASSWORD=your-database-password\n");
  console.error("  Find password: Supabase Dashboard → Project Settings → Database\n");
}
