// Launcher for hosting panels that cannot select hidden paths.
// Expects a prebuilt standalone bundle in .next/standalone.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function logEnvState(stage) {
  const raw = process.env.ADMIN_PASSWORD_HASH || '';
  const prefix = raw.slice(0, 12);
  console.log(
    `[launcher] ${stage} ADMIN_PASSWORD_HASH len=${raw.length} prefix=${JSON.stringify(prefix)}`
  );
}

logEnvState('before-dotenv');

const standaloneEnv = path.join(__dirname, '.next', 'standalone', '.env');
if (fs.existsSync(standaloneEnv)) {
  dotenv.config({ path: standaloneEnv, override: true, quiet: true });
  console.log(`[launcher] loaded env from ${standaloneEnv}`);
} else {
  const rootEnv = path.join(__dirname, '.env');
  if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv, override: true, quiet: true });
    console.log(`[launcher] loaded env from ${rootEnv}`);
  }
}

logEnvState('after-dotenv');

if (process.env.ADMIN_PASSWORD_HASH) {
  process.env.ADMIN_PASSWORD_HASH_B64 = Buffer.from(process.env.ADMIN_PASSWORD_HASH, 'utf8').toString('base64');
  console.log('[launcher] prepared ADMIN_PASSWORD_HASH_B64');
}

const entry = path.join(__dirname, '.next', 'standalone', 'server.js');

if (!fs.existsSync(entry)) {
  console.error('Missing .next/standalone/server.js. Build locally with: npm run build');
  process.exit(1);
}

require(entry);
