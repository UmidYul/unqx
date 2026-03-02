const path = require("path");
const { spawnSync } = require("child_process");

const env = {
  ...process.env,
  NODE_ENV: "production",
  // Keep Rust/SWC thread usage low on constrained shared hosting.
  RAYON_NUM_THREADS: process.env.RAYON_NUM_THREADS || "1",
  UV_THREADPOOL_SIZE: process.env.UV_THREADPOOL_SIZE || "1",
  TOKIO_WORKER_THREADS: process.env.TOKIO_WORKER_THREADS || "1",
};

const prismaBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "prisma.cmd" : "prisma"
);
const nextBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  process.platform === "win32" ? "next.cmd" : "next"
);
const schemaPath = path.join(process.cwd(), "prisma", "schema.prisma");

function run(bin, args) {
  const res = spawnSync(bin, args, {
    stdio: "inherit",
    env,
    shell: process.platform === "win32",
  });
  if (res.error) {
    console.error(`[build] failed to run ${bin}: ${res.error.message}`);
    process.exit(1);
  }
  if (res.status !== 0) {
    process.exit(res.status || 1);
  }
}

run(prismaBin, ["generate", "--schema", schemaPath]);
run(nextBin, ["build"]);
