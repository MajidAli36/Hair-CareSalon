import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function runStep(script) {
  console.log(`> node ${script}\n`);
  const result = spawnSync("node", [script], { cwd: root, stdio: "inherit", shell: false });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\n=== Salon database setup ===\n");
runStep("scripts/db-push.mjs");
runStep("scripts/seed-data.mjs");
