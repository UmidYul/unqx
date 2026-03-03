const path = require("node:path");
const { spawnSync } = require("node:child_process");

const appDir = path.resolve(__dirname, "..");
const schemaPath = path.join(appDir, "prisma", "schema.prisma");
const prismaBin = path.join(
  appDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

const result = spawnSync(prismaBin, ["migrate", "deploy", "--schema", schemaPath], {
  cwd: appDir,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

if (result.error) {
  console.error(`[prisma:migrate:deploy] failed: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}

