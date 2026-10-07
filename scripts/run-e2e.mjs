// Runs Playwright with the QA account from .env.local (run via `node --env-file=.env.local`).
import { spawnSync } from "node:child_process";

if (!process.env.QA_TEST_EMAIL || !process.env.QA_TEST_PASSWORD) throw new Error("QA_TEST_EMAIL / QA_TEST_PASSWORD missing in .env.local");
process.env.E2E_EMAIL = process.env.QA_TEST_EMAIL;
process.env.E2E_PASSWORD = process.env.QA_TEST_PASSWORD;
process.env.E2E_REUSE_SERVER = "1";
const r = spawnSync("npx playwright test", { stdio: "inherit", shell: true });
process.exit(r.status ?? 1);
