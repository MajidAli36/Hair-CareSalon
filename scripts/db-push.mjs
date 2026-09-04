import {
  loadEnvLocal,
  getDatabaseUrlCandidates,
  getProjectRef,
  run,
  printDbEnvHelp,
} from "./load-env.mjs";
import { testConnection } from "./run-sql.mjs";
import { runIncrementalMigrations } from "./run-migrations.mjs";

const env = loadEnvLocal();
const candidates = getDatabaseUrlCandidates(env);
const password = env.SUPABASE_DB_PASSWORD;
const projectRef = getProjectRef(env);

console.log(`\n=== Pushing migrations to ${projectRef} ===\n`);

if (candidates.length) {
  let lastError = null;

  for (const dbUrl of candidates) {
    const host = dbUrl.match(/@([^/]+)/)?.[1] ?? "(unknown host)";
    try {
      console.log(`Connecting via ${host}…`);
      await testConnection(dbUrl);
      console.log("Applying pending migrations from supabase/migrations/…\n");
      const result = await runIncrementalMigrations(dbUrl);
      console.log(
        `\n✓ Done — ${result.ran} applied, ${result.skipped} already up to date (${result.total} total)\n`
      );
      process.exit(0);
    } catch (err) {
      lastError = err;
      console.error(`  ✗ ${err.message}`);
    }
  }

  console.error("\nAll database connection attempts failed.");
  if (lastError) console.error("Last error:", lastError.message);

  if (/ENOTFOUND|ECONNREFUSED|EHOSTUNREACH|IPv6/i.test(String(lastError?.message ?? ""))) {
    console.error(`
This usually means the direct host db.${projectRef}.supabase.co is IPv6-only.
Fix: in Supabase Dashboard → Project Settings → Database → Connection string,
copy the **Pooler** URI (host ends with pooler.supabase.com) into .env.local:

  DATABASE_URL=postgresql://postgres.${projectRef}:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres

Optional if password-only setup:

  SUPABASE_DB_PASSWORD=...
  SUPABASE_DB_REGION=ap-southeast-1
`);
  }

  if (!password) {
    printDbEnvHelp();
    process.exit(1);
  }
  console.log("Falling back to Supabase CLI…\n");
} else if (!password) {
  printDbEnvHelp();
  console.error(
    "\nYou ran `npx supabase db push` without linking. Use instead:\n\n  npm run db:push\n"
  );
  process.exit(1);
}

if (!password) {
  printDbEnvHelp();
  process.exit(1);
}

try {
  run(
    `npx supabase link --project-ref ${projectRef} --password "${password.replace(/"/g, '\\"')}"`,
    { shell: true }
  );
} catch {
  console.log("Link step skipped or already linked — continuing…");
}

run(`npx supabase db push --password "${password.replace(/"/g, '\\"')}"`, {
  shell: true,
});
console.log("\n✓ Migrations applied\n");
