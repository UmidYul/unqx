const { PrismaClient } = require("@prisma/client");
const { env } = require("../config/env");

const globalForPrisma = global;

const prisma =
  globalForPrisma.prismaGlobal ||
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalForPrisma.prismaGlobal = prisma;
}

module.exports = { prisma };
