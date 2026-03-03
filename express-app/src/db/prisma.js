const path = require("node:path");
const { createRequire } = require("node:module");

const { env } = require("../config/env");

const rootRequire = createRequire(path.join(env.ROOT_DIR, "package.json"));
const { PrismaClient } = rootRequire("@prisma/client");
const { PrismaPg } = rootRequire("@prisma/adapter-pg");

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

const globalForPrisma = global;

const prisma =
  globalForPrisma.prismaGlobal ||
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prismaGlobal = prisma;
}

module.exports = { prisma };
