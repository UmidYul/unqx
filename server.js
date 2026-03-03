const path = require("node:path");
const dotenv = require("dotenv");

const localEnvPath = path.join(__dirname, ".env");
const rootEnvPath = path.resolve(__dirname, "..", ".env");

dotenv.config({ path: localEnvPath, override: false, quiet: true });
dotenv.config({ path: rootEnvPath, override: false, quiet: true });

const { createApp } = require("./src/app");
const { env } = require("./src/config/env");

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`[express-app] listening on http://127.0.0.1:${env.PORT}`);
  console.log(`[express-app] trust proxy=${String(env.TRUST_PROXY)}, session cookie secure=${String(env.SESSION_COOKIE_SECURE)}`);
});
