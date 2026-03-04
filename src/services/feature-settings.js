const { prisma } = require("../db/prisma");

const DEFAULTS = {
  leaderboard: {
    enabled: true,
    publicLimit: 20,
    suspiciousThreshold: 50,
    suspiciousWindowMinutes: 10,
  },
  referrals: {
    enabled: true,
    requirePaid: true,
  },
};

async function getFeatureSetting(key, fallback = {}) {
  const row = await prisma.featureSetting.findUnique({ where: { key } });
  const base = DEFAULTS[key] || {};
  const payload = row && row.value && typeof row.value === "object" ? row.value : {};
  return { ...base, ...fallback, ...payload };
}

async function setFeatureSetting(key, value) {
  const base = DEFAULTS[key] || {};
  const next = { ...base, ...(value && typeof value === "object" ? value : {}) };
  await prisma.featureSetting.upsert({
    where: { key },
    create: { key, value: next },
    update: { value: next },
  });
  return next;
}

module.exports = {
  DEFAULTS,
  getFeatureSetting,
  setFeatureSetting,
};
