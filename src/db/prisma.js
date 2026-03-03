const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const { env } = require("../config/env");

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
