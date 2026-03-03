const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const { env } = require("../config/env");
const pg = require("pg");

const prismaPool = new pg.Pool({
  connectionString: env.DATABASE_URL,
});

const adapter = new PrismaPg(prismaPool);

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
