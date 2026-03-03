const fs = require("node:fs/promises");
const path = require("node:path");
const { build } = require("esbuild");

const rootDir = path.resolve(__dirname, "..");
const vendorDir = path.join(rootDir, "public", "vendor");

const files = [
  {
    source: path.join(rootDir, "node_modules", "sortablejs", "Sortable.min.js"),
    target: path.join(vendorDir, "sortablejs", "Sortable.min.js"),
  },
  {
    source: path.join(rootDir, "node_modules", "cropperjs", "dist", "cropper.min.js"),
    target: path.join(vendorDir, "cropperjs", "cropper.min.js"),
  },
  {
    source: path.join(rootDir, "node_modules", "cropperjs", "dist", "cropper.min.css"),
    target: path.join(vendorDir, "cropperjs", "cropper.min.css"),
  },
  {
    source: path.join(rootDir, "node_modules", "chart.js", "dist", "chart.umd.min.js"),
    target: path.join(vendorDir, "chartjs", "chart.umd.min.js"),
  },
];

async function copyFile(source, target) {
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
}

async function main() {
  await Promise.all(files.map((entry) => copyFile(entry.source, entry.target)));
  await fs.mkdir(path.join(vendorDir, "qrcode"), { recursive: true });
  await build({
    entryPoints: [path.join(rootDir, "node_modules", "qrcode", "lib", "browser.js")],
    bundle: true,
    format: "iife",
    globalName: "QRCode",
    minify: true,
    outfile: path.join(vendorDir, "qrcode", "qrcode.min.js"),
    platform: "browser",
    target: ["es2019"],
  });

  console.log(`[vendor] copied ${files.length} assets to ${vendorDir}`);
}

main().catch((error) => {
  console.error("[vendor] failed to copy assets");
  console.error(error);
  process.exit(1);
});
