import pg from "pg";
import { loadEnvLocal, getDatabaseUrl, getProjectRef } from "./load-env.mjs";

const env = loadEnvLocal();
const parsed = new URL(getDatabaseUrl(env));
const ref = getProjectRef(env);
const client = new pg.Client({
  host: "aws-0-ap-northeast-2.pooler.supabase.com",
  port: 6543,
  user: `postgres.${ref}`,
  password: decodeURIComponent(parsed.password),
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});

await client.connect();
await client.query("notify pgrst, 'reload schema'");
const r = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name in ('sale_versions', 'sale_version_items', 'sale_refunds')
  order by 1
`);
console.log("tables:", r.rows.map((x) => x.table_name).join(", "));
console.log("schema cache reload notified");
await client.end();
