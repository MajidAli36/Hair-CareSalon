import { loadEnvLocal, getDatabaseUrl, getProjectRef } from "./load-env.mjs";
import { runIncrementalMigrations } from "./run-migrations.mjs";
import pg from "pg";
import dns from "dns";
import { promisify } from "util";

const resolve6 = promisify(dns.resolve6);
const env = loadEnvLocal();
const url = getDatabaseUrl(env);
if (!url) {
  console.error("No DATABASE_URL / SUPABASE_DB_PASSWORD in .env.local");
  process.exit(1);
}

const u = new URL(url);
const ref = getProjectRef(env);

async function tryConnect(config, label) {
  const client = new pg.Client({
    ...config,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20000,
  });
  try {
    await client.connect();
    console.log(`✓ Connected via ${label}`);
    await client.end();
    return true;
  } catch (e) {
    console.log(`✗ ${label}: ${e.code || e.message}`);
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return false;
  }
}

const base = {
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database: u.pathname.replace(/^\//, "") || "postgres",
};

console.log(`Project: ${ref}`);
console.log(`Configured host: ${u.hostname}:${u.port || 5432}`);

let migrationUrl = url;

// Prefer IPv6 literal when AAAA exists but Node IPv4 lookup fails
try {
  const ipv6 = (await resolve6(u.hostname))[0];
  console.log(`Resolved AAAA: ${ipv6}`);
  const ok = await tryConnect({ ...base, host: ipv6, port: Number(u.port || 5432) }, "IPv6 literal");
  if (ok) {
    migrationUrl = `postgresql://${encodeURIComponent(base.user)}:${encodeURIComponent(base.password)}@[${ipv6}]:${u.port || 5432}/${base.database}`;
  } else {
    // Try common pooler hosts (session mode, port 5432)
    const regions = ["ap-south-1", "ap-southeast-1", "eu-west-1", "eu-central-1", "us-east-1", "us-west-1"];
    let pooled = false;
    for (const region of regions) {
      const host = `aws-0-${region}.pooler.supabase.com`;
      const user = `postgres.${ref}`;
      const okPool = await tryConnect(
        { ...base, host, port: 6543, user },
        `pooler ${region}:6543`
      );
      if (okPool) {
        migrationUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(base.password)}@${host}:6543/${base.database}`;
        pooled = true;
        break;
      }
    }
    if (!pooled) {
      console.error("\nCould not reach the database. Add a pooler DATABASE_URL from Supabase Dashboard → Connect.");
      process.exit(1);
    }
  }
} catch (e) {
  console.error("DNS resolve failed:", e.message);
  process.exit(1);
}

console.log("\nApplying pending migrations…\n");
const result = await runIncrementalMigrations(migrationUrl);
console.log(
  `\n✓ Done — ${result.ran} applied, ${result.skipped} already up to date (${result.total} total)\n`
);
