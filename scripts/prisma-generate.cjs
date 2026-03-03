const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const appDir = path.resolve(__dirname, "..");
const schemaCandidates = [
  path.resolve(appDir, "..", "prisma", "schema.prisma"),
  path.resolve(appDir, "prisma", "schema.prisma"),
];
const sourceSchema = schemaCandidates.find((candidate) => fs.existsSync(candidate));
const localPrismaDir = path.join(appDir, "prisma");
const localSchema = path.join(localPrismaDir, "schema.prisma");

if (!sourceSchema) {
  console.error("[prisma:generate] source schema not found. Checked:");
  for (const candidate of schemaCandidates) {
    console.error(`- ${candidate}`);
  }
  process.exit(1);
}

fs.mkdirSync(localPrismaDir, { recursive: true });
fs.copyFileSync(sourceSchema, localSchema);

const prismaBin = path.join(
  appDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma",
);

const result = spawnSync(prismaBin, ["generate", "--schema", localSchema], {
  cwd: appDir,
  stdio: "inherit",
  shell: process.platform === "win32",
  env: process.env,
});

if (result.error) {
  console.error(`[prisma:generate] failed: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status || 1);
}
