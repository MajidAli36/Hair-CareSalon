import { loadEnvLocal, getProjectRef, getDatabaseUrl, run, printDbEnvHelp } from "./load-env.mjs";

const env = loadEnvLocal();
const projectRef = getProjectRef(env);
const password = env.SUPABASE_DB_PASSWORD;

if (!password && !getDatabaseUrl(env)) {
  printDbEnvHelp();
  process.exit(1);
}

console.log(`\n=== Linking Supabase project ${projectRef} ===\n`);

if (password) {
  run(
    `npx supabase link --project-ref ${projectRef} --password "${password.replace(/"/g, '\\"')}"`,
    { shell: true }
  );
} else {
  run(`npx supabase link --project-ref ${projectRef}`, { shell: true });
}

console.log("\n✓ Linked. You can now run: npx supabase db push\n");
