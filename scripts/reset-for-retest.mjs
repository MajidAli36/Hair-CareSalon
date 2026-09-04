/**
 * Wipe all business data (keep org + member roles), then re-seed.
 * Login: owner@salon.com / Salon123!
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { loadEnvLocal, getDatabaseUrl, getProjectRef, printDbEnvHelp } from "./load-env.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlFile = resolve(__dirname, "../supabase/reset-business-data.sql");

const OWNER_EMAIL = "owner@salon.com";
const OWNER_PASSWORD = "Salon123!";
const ORG_SLUG = "hair-salon";

const ROLE_USERS = [
  { email: "owner@salon.com", password: OWNER_PASSWORD, role: "OWNER" },
  { email: "admin@salon.com", password: OWNER_PASSWORD, role: "ADMIN" },
  { email: "manager@salon.com", password: OWNER_PASSWORD, role: "MANAGER" },
  { email: "cashier@salon.com", password: OWNER_PASSWORD, role: "CASHIER" },
  { email: "reception@salon.com", password: OWNER_PASSWORD, role: "RECEPTIONIST" },
  { email: "staff@salon.com", password: OWNER_PASSWORD, role: "STAFF" },
];

const env = loadEnvLocal();
const dbUrl = getDatabaseUrl(env);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const ref = getProjectRef(env);

if (!dbUrl) {
  printDbEnvHelp();
  process.exit(1);
}

function poolClient() {
  const parsed = new URL(dbUrl);
  const password = decodeURIComponent(parsed.password);
  const poolUser = parsed.username.includes(".")
    ? decodeURIComponent(parsed.username)
    : `postgres.${ref}`;

  return new pg.Client({
    host: parsed.hostname.includes("pooler")
      ? parsed.hostname
      : "aws-0-ap-northeast-2.pooler.supabase.com",
    port: parsed.hostname.includes("pooler") ? Number(parsed.port || 6543) : 6543,
    user: poolUser,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
}

async function wipeBusinessData() {
  const client = poolClient();
  await client.connect();
  console.log("Connected — wiping business data (keeping org + roles)…");
  const sql = readFileSync(sqlFile, "utf8");
  await client.query(sql);
  await client.end();
  console.log("✓ Business data wiped");
}

async function ensureLoginsAndSeed() {
  if (!serviceKey || !url) {
    console.warn("No SUPABASE_SERVICE_ROLE_KEY — skipping user reset. Run npm run db:seed after.");
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let orgId;
  const { data: existingOrg } = await admin
    .from("organizations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .maybeSingle();

  if (existingOrg) {
    orgId = existingOrg.id;
  } else {
    const { data, error } = await admin
      .from("organizations")
      .insert({ name: "Hair & Care Salon", slug: ORG_SLUG })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    orgId = data.id;
  }

  const { data: listed } = await admin.auth.admin.listUsers({ perPage: 200 });
  const byEmail = new Map((listed?.users ?? []).map((u) => [u.email?.toLowerCase(), u]));

  for (const row of ROLE_USERS) {
    let userId = byEmail.get(row.email.toLowerCase())?.id;
    if (userId) {
      await admin.auth.admin.updateUserById(userId, {
        password: row.password,
        email_confirm: true,
      });
      console.log(`Reset password: ${row.email}`);
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email: row.email,
        password: row.password,
        email_confirm: true,
      });
      if (error) throw new Error(`${row.email}: ${error.message}`);
      userId = data.user.id;
      console.log(`Created user: ${row.email}`);
    }

    const { data: member } = await admin
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!member) {
      const { error } = await admin.from("organization_members").insert({
        organization_id: orgId,
        user_id: userId,
        role: row.role,
      });
      if (error) throw new Error(error.message);
    } else if (member.role !== row.role) {
      await admin
        .from("organization_members")
        .update({ role: row.role })
        .eq("id", member.id);
    }
  }

  // Minimal catalog for fresh retest
  const { count } = await admin
    .from("services")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId);

  if (!count) {
    const { data: cats } = await admin
      .from("service_categories")
      .insert([
        { organization_id: orgId, name: "Hair", sort_order: 1 },
        { organization_id: orgId, name: "Nails", sort_order: 2 },
      ])
      .select("id, name");

    const hairCat = cats?.find((c) => c.name === "Hair")?.id;
    const nailCat = cats?.find((c) => c.name === "Nails")?.id;

    await admin.from("services").insert([
      {
        organization_id: orgId,
        category_id: hairCat,
        name: "Haircut",
        price: 1500,
        duration_minutes: 45,
      },
      {
        organization_id: orgId,
        category_id: hairCat,
        name: "Hair Color",
        price: 4500,
        duration_minutes: 120,
      },
      {
        organization_id: orgId,
        category_id: nailCat,
        name: "Manicure",
        price: 1200,
        duration_minutes: 40,
      },
    ]);
    await admin.from("staff").insert([
      {
        organization_id: orgId,
        full_name: "Ayesha Khan",
        job_title: "Senior Stylist",
        pin_code: "1234",
        phone: "+923001234567",
      },
    ]);
    await admin.from("customers").insert([
      {
        organization_id: orgId,
        first_name: "Sara",
        last_name: "Ahmed",
        phone: "+923009876543",
        email: "sara@example.com",
        tags: ["VIP"],
      },
    ]);
    console.log("✓ Fresh sample catalog seeded");
  }
}

console.log("\n=== Reset for retest ===\n");
await wipeBusinessData();
await ensureLoginsAndSeed();
console.log("\n✓ Ready to test\n");
console.log("Login at http://localhost:3000/login");
console.log(`  Email:    ${OWNER_EMAIL}`);
console.log(`  Password: ${OWNER_PASSWORD}`);
console.log("\nAll role logins use password Salon123!");
console.log("  owner@salon.com | admin@salon.com | manager@salon.com");
console.log("  cashier@salon.com | reception@salon.com | staff@salon.com\n");
