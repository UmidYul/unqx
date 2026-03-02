const fs = require("fs");
const path = require("path");

const projectRoot = process.cwd();
const standaloneRoot = path.join(projectRoot, ".next", "standalone");

function copyDirIfExists(src, dst, label) {
  if (!fs.existsSync(src)) {
    console.warn(`[sync-prisma-standalone] ${label} not found, skipping`);
    return;
  }
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true, force: true });
  console.log(`[sync-prisma-standalone] copied ${label} from ${src} to ${dst}`);
}

copyDirIfExists(
  path.join(projectRoot, "node_modules", ".prisma", "client"),
  path.join(standaloneRoot, "node_modules", ".prisma", "client"),
  ".prisma/client"
);

copyDirIfExists(
  path.join(projectRoot, ".next", "static"),
  path.join(standaloneRoot, ".next", "static"),
  ".next/static"
);

copyDirIfExists(
  path.join(projectRoot, "public"),
  path.join(standaloneRoot, "public"),
  "public"
);
