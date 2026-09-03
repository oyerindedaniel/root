import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const allowed = new Set(["db:migrate", "db:seed", "db:seed:providers"]);
const requested = process.argv.slice(2);
const scripts = requested.length > 0 ? requested : ["db:migrate", "db:seed"];

const prodEnv = resolve("apps/api/.env");
if (!existsSync(prodEnv)) {
  console.error("apps/api/.env is required for db:prod");
  process.exit(1);
}

const env = { ...process.env, DOTENV_CONFIG_PATH: prodEnv };

function run(script) {
  if (!allowed.has(script)) {
    console.error(`db:prod refuses ${script}`);
    process.exit(1);
  }
  const result = spawnSync(`pnpm ${script}`, {
    stdio: "inherit",
    shell: true,
    env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

for (const script of scripts) {
  run(script);
}
