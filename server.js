const path = require("node:path");
const dotenv = require("dotenv");

const localEnvPath = path.join(__dirname, ".env");
const rootEnvPath = path.resolve(__dirname, "..", ".env");

dotenv.config({ path: localEnvPath, override: false, quiet: true });
dotenv.config({ path: rootEnvPath, override: false, quiet: true });

const { createApp } = require("./src/app");
const { env } = require("./src/config/env");
const { prisma } = require("./src/db/prisma");

const app = createApp();

async function bootstrap() {
  try {
    await prisma.$connect();
  } catch (error) {
    console.error("[express-app] prisma connection failed during startup", error);
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    console.log(`[express-app] listening on http://127.0.0.1:${env.PORT}`);
    console.log(`[express-app] trust proxy=${String(env.TRUST_PROXY)}, session cookie secure=${String(env.SESSION_COOKIE_SECURE)}`);
  });

  async function shutdown(signal) {
    console.log(`[express-app] received ${signal}, shutting down`);
    server.close(async () => {
      try {
        await prisma.$disconnect();
      } finally {
        process.exit(0);
      }
    });
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
}

void bootstrap();
