import {
  loadEnvLocal,
  getDatabaseUrl,
  getProjectRef,
  run,
  printDbEnvHelp,
} from "./load-env.mjs";
import { testConnection } from "./run-sql.mjs";
import { runIncrementalMigrations } from "./run-migrations.mjs";

const env = loadEnvLocal();
const dbUrl = getDatabaseUrl(env);
const password = env.SUPABASE_DB_PASSWORD;
const projectRef = getProjectRef(env);

console.log(`\n=== Pushing migrations to ${projectRef} ===\n`);

if (dbUrl) {
  try {
    console.log("Connecting to database…");
    await testConnection(dbUrl);
    console.log("Applying pending migrations from supabase/migrations/…\n");
    const result = await runIncrementalMigrations(dbUrl);
    console.log(
      `\n✓ Done — ${result.ran} applied, ${result.skipped} already up to date (${result.total} total)\n`
    );
    process.exit(0);
  } catch (err) {
    console.error("\nDirect migration failed:", err.message);
    if (!password) {
      console.error(
        "\nTip: use npm run db:push (not npx supabase db push) — it reads DATABASE_URL from .env.local.\n"
      );
      process.exit(1);
    }
    console.log("Falling back to Supabase CLI…\n");
  }
}

if (!password) {
  printDbEnvHelp();
  console.error(
    "\nYou ran `npx supabase db push` without linking. Use instead:\n\n  npm run db:push\n"
  );
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
