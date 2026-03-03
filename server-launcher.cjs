// Launcher for hosting panels that cannot select hidden paths.
// Expects a prebuilt standalone bundle in .next/standalone.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const standaloneEnv = path.join(__dirname, '.next', 'standalone', '.env');
if (fs.existsSync(standaloneEnv)) {
  dotenv.config({ path: standaloneEnv, override: true });
} else {
  const rootEnv = path.join(__dirname, '.env');
  if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv, override: true });
  }
}

const entry = path.join(__dirname, '.next', 'standalone', 'server.js');

if (!fs.existsSync(entry)) {
  console.error('Missing .next/standalone/server.js. Build locally with: npm run build');
  process.exit(1);
}

require(entry);
