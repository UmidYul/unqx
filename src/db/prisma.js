const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const pg = require("pg");
const { env } = require("../config/env");

const globalForPrisma = global;

const prismaPool =
  globalForPrisma.prismaPoolGlobal ||
  new pg.Pool({
    connectionString: env.DATABASE_URL,
  });

const adapter = new PrismaPg(prismaPool);

const prisma =
  globalForPrisma.prismaGlobal ||
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prismaGlobal = prisma;
  globalForPrisma.prismaPoolGlobal = prismaPool;
}

module.exports = { prisma };
