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
  env: {
    ...process.env,
    CHECKPOINT_DISABLE: process.env.CHECKPOINT_DISABLE || "1",
    PRISMA_HIDE_UPDATE_MESSAGE: process.env.PRISMA_HIDE_UPDATE_MESSAGE || "1",
    PRISMA_DISABLE_WARNINGS: process.env.PRISMA_DISABLE_WARNINGS || "1",
  },
});

function sleep(ms) {
  const sab = new SharedArrayBuffer(4);
  const int32 = new Int32Array(sab);
  Atomics.wait(int32, 0, 0, ms);
}

let finalResult = result;
if (result.error && result.error.code === "EAGAIN") {
  const retries = 3;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    console.warn(`[prisma:generate] EAGAIN on spawn, retry ${attempt}/${retries}...`);
    sleep(300 * attempt);
    finalResult = spawnSync(prismaBin, ["generate", "--schema", localSchema], {
      cwd: appDir,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        CHECKPOINT_DISABLE: process.env.CHECKPOINT_DISABLE || "1",
        PRISMA_HIDE_UPDATE_MESSAGE: process.env.PRISMA_HIDE_UPDATE_MESSAGE || "1",
        PRISMA_DISABLE_WARNINGS: process.env.PRISMA_DISABLE_WARNINGS || "1",
      },
    });
    if (!finalResult.error) {
      break;
    }
    if (finalResult.error.code !== "EAGAIN") {
      break;
    }
  }
}

if (finalResult.error) {
  console.error(`[prisma:generate] failed: ${finalResult.error.message}`);
  process.exit(1);
}

if (finalResult.status !== 0) {
  process.exit(finalResult.status || 1);
}
