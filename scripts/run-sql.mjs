import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import dns from "node:dns/promises";
import pg from "pg";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

/**
 * db.<ref>.supabase.co is often AAAA-only. Node's default lookup can ENOTFOUND
 * even when nslookup works — resolve AAAA ourselves and connect with SNI.
 */
export async function resolvePostgresConfig(connectionString) {
  const u = new URL(connectionString);
  const hostname = u.hostname;
  const port = Number(u.port || 5432);
  const user = decodeURIComponent(u.username);
  const password = decodeURIComponent(u.password);
  const database = u.pathname.replace(/^\//, "") || "postgres";

  const base = {
    user,
    password,
    database,
    port,
    ssl: { rejectUnauthorized: false, servername: hostname },
    connectionTimeoutMillis: 20_000,
  };

  if (!hostname.startsWith("db.") || !hostname.endsWith(".supabase.co")) {
    return { ...base, host: hostname, connectionString };
  }

  try {
    const v6 = await dns.resolve6(hostname);
    if (v6?.[0]) {
      return {
        ...base,
        host: v6[0],
        // pg needs explicit host for IPv6; don't pass connectionString
      };
    }
  } catch {
    // fall through
  }

  return { ...base, host: hostname, connectionString };
}

export async function createPgClient(connectionString) {
  const config = await resolvePostgresConfig(connectionString);
  return new Client(config);
}

export async function runSqlFile(connectionString, relativePath) {
  const filePath = resolve(root, relativePath);
  let sql = readFileSync(filePath, "utf8");
  if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1);
  const client = await createPgClient(connectionString);

  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

export async function testConnection(connectionString) {
  const client = await createPgClient(connectionString);
  await client.connect();
  await client.end();
}

export async function runSql(connectionString, sql) {
  const client = await createPgClient(connectionString);
  await client.connect();
  try {
    return await client.query(sql);
  } finally {
    await client.end();
  }
}
