import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const prodEnv = resolve("apps/api/.env");
const env = { ...process.env };
if (existsSync(prodEnv)) {
  env.DOTENV_CONFIG_PATH = prodEnv;
}

function run(args) {
  const result = spawnSync("pnpm", args, {
    stdio: "inherit",
    shell: true,
    env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run(["db:migrate"]);
run(["db:seed"]);
