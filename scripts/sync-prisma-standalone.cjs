const fs = require("fs");
const path = require("path");

const src = path.join(process.cwd(), "node_modules", ".prisma", "client");
const dst = path.join(process.cwd(), ".next", "standalone", "node_modules", ".prisma", "client");

if (!fs.existsSync(src)) {
  console.warn("[sync-prisma-standalone] source .prisma/client not found, skipping");
  process.exit(0);
}

if (!fs.existsSync(path.dirname(dst))) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
}

fs.cpSync(src, dst, { recursive: true, force: true });
console.log(`[sync-prisma-standalone] copied Prisma client from ${src} to ${dst}`);
