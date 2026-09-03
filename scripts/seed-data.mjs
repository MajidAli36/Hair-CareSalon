import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal, getDatabaseUrl, printDbEnvHelp } from "./load-env.mjs";
import { runSqlFile } from "./run-sql.mjs";

const env = loadEnvLocal();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const dbUrl = getDatabaseUrl(env);

const OWNER_EMAIL = "owner@salon.com";
const OWNER_PASSWORD = "Salon123!";
const ORG_SLUG = "hair-salon";

async function seedViaSql() {
  if (!dbUrl) {
    printDbEnvHelp();
    process.exit(1);
  }
  console.log("Seeding via SQL (supabase/seed.sql)…");
  await runSqlFile(dbUrl, "supabase/seed.sql");
}

async function seedViaAdminApi() {
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  async function getOrCreateOwner() {
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list?.users?.find((u) => u.email === OWNER_EMAIL);
    if (existing) {
      console.log(`User already exists: ${OWNER_EMAIL}`);
      await admin.auth.admin.updateUserById(existing.id, {
        password: OWNER_PASSWORD,
        email_confirm: true,
      });
      return existing.id;
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Create user failed: ${error.message}`);
    console.log(`Created user: ${OWNER_EMAIL}`);
    return data.user.id;
  }

  async function seedOrganization(ownerId) {
    let orgId;
    const { data: existingOrg } = await admin
      .from("organizations")
      .select("id")
      .eq("slug", ORG_SLUG)
      .maybeSingle();

    if (existingOrg) {
      orgId = existingOrg.id;
      await admin
        .from("organizations")
        .update({ name: "Hair & Care Salon" })
        .eq("id", orgId);
    } else {
      const { data, error } = await admin
        .from("organizations")
        .insert({ name: "Hair & Care Salon", slug: ORG_SLUG })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      orgId = data.id;
    }

    const { data: member } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", ownerId)
      .maybeSingle();

    if (!member) {
      const { error } = await admin.from("organization_members").insert({
        organization_id: orgId,
        user_id: ownerId,
        role: "OWNER",
      });
      if (error) throw new Error(error.message);
    }

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
        { organization_id: orgId, category_id: hairCat, name: "Haircut", price: 1500, duration_minutes: 45 },
        { organization_id: orgId, category_id: hairCat, name: "Hair Color", price: 4500, duration_minutes: 120 },
        { organization_id: orgId, category_id: nailCat, name: "Manicure", price: 1200, duration_minutes: 40 },
      ]);
      await admin.from("staff").insert([
        { organization_id: orgId, full_name: "Ayesha Khan", job_title: "Senior Stylist", pin_code: "1234", phone: "+923001234567" },
      ]);
      await admin.from("customers").insert([
        { organization_id: orgId, first_name: "Sara", last_name: "Ahmed", phone: "+923009876543", email: "sara@example.com", tags: ["VIP"] },
      ]);
    }
  }

  const ownerId = await getOrCreateOwner();
  await seedOrganization(ownerId);
}

async function main() {
  console.log("\n=== Salon seed ===\n");

  if (serviceKey && url) {
    try {
      await seedViaAdminApi();
    } catch (err) {
      console.warn("Admin API seed failed:", err.message);
      console.log("Trying SQL seed instead…\n");
      await seedViaSql();
    }
  } else {
    await seedViaSql();
  }

  console.log("\n✓ Seed complete\n");
  console.log("Login at http://localhost:3000/login");
  console.log(`  Email:    ${OWNER_EMAIL}`);
  console.log(`  Password: ${OWNER_PASSWORD}`);
  console.log(`\nOnline booking: http://localhost:3000/book/${ORG_SLUG}\n`);
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  if (err.message.includes("relation") || err.message.includes("does not exist")) {
    console.error("\nRun migrations first: npm run db:push\n");
  }
  process.exit(1);
});
