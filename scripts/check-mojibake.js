const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");
const TARGETS = [
  "src/services/platform-settings.js",
  "src/routes/api/cards.js",
];
const MOJIBAKE_PATTERN = /(?:Р.|С.){3,}|пїЅ|�/u;

const issues = [];

for (const target of TARGETS) {
  const filePath = path.join(ROOT_DIR, target);
  if (!fs.existsSync(filePath)) {
    issues.push(`${target}: file not found`);
    continue;
  }

  const content = fs.readFileSync(filePath, "utf8");
  if (content.charCodeAt(0) === 0xfeff) {
    issues.push(`${target}: contains UTF-8 BOM`);
  }

  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (MOJIBAKE_PATTERN.test(line)) {
      issues.push(`${target}:${index + 1}: mojibake pattern detected`);
    }
  });
}

if (issues.length) {
  console.error("[check:mojibake] failed");
  issues.forEach((issue) => console.error(`- ${issue}`));
  process.exit(1);
}

console.log("[check:mojibake] ok");
