const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = process.cwd();
const args = process.argv.slice(2);
const formatArgIndex = args.findIndex((x) => x === "--format");
const format = formatArgIndex >= 0 ? args[formatArgIndex + 1] : "tar.gz";
const supportedFormats = new Set(["tar.gz", "zip"]);

if (!supportedFormats.has(format)) {
  console.error(`[pack] unsupported format "${format}". Use: tar.gz or zip`);
  process.exit(1);
}

const standaloneDir = path.join(root, ".next", "standalone");
if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
  console.error("[pack] .next/standalone/server.js not found. Run `npm run build` first.");
  process.exit(1);
}

const artifactsDir = path.join(root, "artifacts");
const stageDir = path.join(root, ".deploy-stage");
fs.rmSync(stageDir, { recursive: true, force: true });
fs.mkdirSync(path.join(stageDir, ".next"), { recursive: true });
fs.mkdirSync(artifactsDir, { recursive: true });

fs.cpSync(standaloneDir, path.join(stageDir, ".next", "standalone"), {
  recursive: true,
  force: true,
});

const launcherSrc = path.join(root, "server-launcher.cjs");
if (!fs.existsSync(launcherSrc)) {
  console.error("[pack] server-launcher.cjs not found in project root.");
  process.exit(1);
}
fs.copyFileSync(launcherSrc, path.join(stageDir, "server-launcher.cjs"));

const envInArchive = path.join(stageDir, ".next", "standalone", ".env");
if (fs.existsSync(envInArchive)) {
  fs.rmSync(envInArchive, { force: true });
}

const ts = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace(/\..+/, "")
  .replace("T", "-");
const baseName = `unqx-standalone-${ts}`;
const outFile = path.join(artifactsDir, `${baseName}.${format === "zip" ? "zip" : "tar.gz"}`);

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  if (result.error) {
    console.error(`[pack] failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (format === "tar.gz") {
  run("tar", ["-czf", outFile, "-C", stageDir, "."]);
} else if (process.platform === "win32") {
  run("powershell", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${stageDir}\\*' -DestinationPath '${outFile}' -Force`,
  ]);
} else {
  run("zip", ["-r", outFile, "."], { cwd: stageDir });
}

fs.rmSync(stageDir, { recursive: true, force: true });
console.log(`[pack] created archive: ${outFile}`);

