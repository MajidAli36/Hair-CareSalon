import { readdirSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const migrationsDir = resolve(root, "supabase/migrations");

const TRACKING_SQL = `
create table if not exists public.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
`;

function listMigrationFiles() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

async function tableExists(client, table) {
  const { rows } = await client.query(
    `select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = $1
    ) as ok`,
    [table]
  );
  return rows[0]?.ok ?? false;
}

async function columnExists(client, table, column) {
  const { rows } = await client.query(
    `select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = $1 and column_name = $2
    ) as ok`,
    [table, column]
  );
  return rows[0]?.ok ?? false;
}

async function typeExists(client, typeName) {
  const { rows } = await client.query(
    `select exists (select 1 from pg_type where typname = $1) as ok`,
    [typeName]
  );
  return rows[0]?.ok ?? false;
}

function splitSqlStatements(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

async function runStatementsIndividually(client, sql) {
  for (const statement of splitSqlStatements(sql)) {
    await client.query(statement);
  }
}

/** Mark migrations already present in an existing database (e.g. from combined-migration.sql). */
async function bootstrapAppliedMigrations(client) {
  const { rows } = await client.query("select version from public.schema_migrations");
  const applied = new Set(rows.map((r) => r.version));

  const hasOrg = await tableExists(client, "organizations");
  if (!hasOrg) return;

  const markers = [
    { file: "20250902100000_extensions.sql", ok: () => true },
    { file: "20250902100001_enums.sql", ok: () => typeExists(client, "member_role") },
    { file: "20250902100002_organizations.sql", ok: () => tableExists(client, "organizations") },
    {
      file: "20250902100003_organization_members.sql",
      ok: () => tableExists(client, "organization_members"),
    },
    { file: "20250902100004_rls_policies.sql", ok: () => hasOrg },
    { file: "20250902100005_customers.sql", ok: () => tableExists(client, "customers") },
    { file: "20250902100006_services.sql", ok: () => tableExists(client, "services") },
    { file: "20250902100007_packages.sql", ok: () => tableExists(client, "packages") },
    { file: "20250902100008_products.sql", ok: () => tableExists(client, "products") },
    { file: "20250902100009_inventory.sql", ok: () => tableExists(client, "inventory_transactions") },
    { file: "20250902100010_sales.sql", ok: () => tableExists(client, "sales") },
    { file: "20250902100011_invoices_payments.sql", ok: () => tableExists(client, "invoices") },
    { file: "20250902100012_whatsapp.sql", ok: () => tableExists(client, "whatsapp_messages") },
    { file: "20250902100013_audit_logs.sql", ok: () => tableExists(client, "audit_logs") },
    { file: "20250902100014_staff.sql", ok: () => tableExists(client, "staff") },
    { file: "20250902100015_appointments.sql", ok: () => tableExists(client, "appointments") },
    { file: "20250902100016_queue_tokens.sql", ok: () => tableExists(client, "queue_tokens") },
    { file: "20250902100017_attendance_devices.sql", ok: () => tableExists(client, "devices") },
    { file: "20250902100018_devices_staff_select.sql", ok: () => hasOrg },
    { file: "20250902100019_sales_tax.sql", ok: () => columnExists(client, "sales", "tax") },
    {
      file: "20250902100020_org_whatsapp_phone.sql",
      ok: () => columnExists(client, "organizations", "whatsapp_phone"),
    },
    {
      file: "20250902100021_nav_permissions.sql",
      ok: () => columnExists(client, "organizations", "nav_permissions"),
    },
    {
      file: "20250902100022_financial_flow.sql",
      ok: () => columnExists(client, "appointment_deposits", "organization_id"),
    },
    {
      file: "20250902100023_booking_scheduler.sql",
      ok: () => columnExists(client, "organizations", "booking_slot_minutes"),
    },
    {
      file: "20250902100024_staff_online_booking.sql",
      ok: () => columnExists(client, "staff", "online_booking_enabled"),
    },
    {
      file: "20250902100025_booking_advance_approval.sql",
      ok: () => columnExists(client, "appointment_deposits", "status"),
    },
    {
      file: "20250902100026_staff_payments.sql",
      ok: () => tableExists(client, "staff_payments"),
    },
    {
      file: "20250902100027_deposit_refunds.sql",
      ok: () => columnExists(client, "appointment_deposits", "refund_reason"),
    },
    {
      file: "20250902100028_thumb_attendance.sql",
      ok: () => columnExists(client, "staff", "thumb_id"),
    },
    {
      file: "20250902100029_queue_staff_chair.sql",
      ok: () => columnExists(client, "queue_tokens", "chair"),
    },
    {
      file: "20250902100030_chairs.sql",
      ok: () => tableExists(client, "chairs"),
    },
  ];

  let bootstrapped = 0;
  for (const { file, ok } of markers) {
    if (applied.has(file)) continue;
    if (!(await ok())) continue;
    await client.query(
      "insert into public.schema_migrations (version) values ($1) on conflict do nothing",
      [file]
    );
    applied.add(file);
    bootstrapped++;
    console.log(`  baseline ${file}`);
  }

  if (bootstrapped > 0) {
    console.log(`  (${bootstrapped} existing migrations marked as applied)\n`);
  }
}

export async function runIncrementalMigrations(connectionString) {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(TRACKING_SQL);
    await bootstrapAppliedMigrations(client);

    const { rows } = await client.query(
      "select version from public.schema_migrations"
    );
    const applied = new Set(rows.map((r) => r.version));
    const files = listMigrationFiles();
    let ran = 0;

    const NON_TRANSACTIONAL = new Set([
      "20250902100027_deposit_refunds.sql",
      "20250902100028_thumb_attendance.sql",
    ]);

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const filePath = resolve(migrationsDir, file);
      let sql = readFileSync(filePath, "utf8");
      if (sql.charCodeAt(0) === 0xfeff) sql = sql.slice(1);

      console.log(`  apply ${file}`);

      if (NON_TRANSACTIONAL.has(file)) {
        await runStatementsIndividually(client, sql);
        await client.query(
          "insert into public.schema_migrations (version) values ($1)",
          [file]
        );
        ran++;
        continue;
      }

      await client.query("begin");
      try {
        await client.query(sql);
        await client.query(
          "insert into public.schema_migrations (version) values ($1)",
          [file]
        );
        await client.query("commit");
        ran++;
      } catch (err) {
        await client.query("rollback");
        throw new Error(`${file}: ${err.message}`);
      }
    }

    return { total: files.length, ran, skipped: files.length - ran };
  } finally {
    await client.end();
  }
}
