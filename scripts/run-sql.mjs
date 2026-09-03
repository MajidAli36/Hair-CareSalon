import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

export async function runSqlFile(connectionString, relativePath) {
  const filePath = resolve(root, relativePath);
  let sql = readFileSync(filePath, "utf8");
  if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1);
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

export async function testConnection(connectionString) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.end();
}
