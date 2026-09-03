import { loadEnvLocal, getDatabaseUrl, printDbEnvHelp } from "./load-env.mjs";
import { runSqlFile } from "./run-sql.mjs";

const dbUrl = getDatabaseUrl(loadEnvLocal());
if (!dbUrl) {
  printDbEnvHelp();
  process.exit(1);
}

console.log("\n=== Fixing auth.users token columns ===\n");
await runSqlFile(dbUrl, "supabase/fix-auth-users.sql");
console.log("\n✓ Auth users fixed — try logging in again\n");
