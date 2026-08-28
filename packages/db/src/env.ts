import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const apiRoot = resolve(fileURLToPath(new URL("../../../apps/api", import.meta.url)));
const localPath = resolve(apiRoot, ".env.local");
const envPath = resolve(apiRoot, ".env");

if (existsSync(localPath)) {
  config({ path: localPath });
}
config({ path: envPath });
