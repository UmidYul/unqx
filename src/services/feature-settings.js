const { prisma } = require("../db/prisma");
const { getManySettings, setSettingsBatch } = require("./platform-settings");

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
  unqScore: {
    enabledOnCards: true,
  },
  pricing: {
    planBasicPrice: 50_000,
    planPremiumPrice: 130_000,
    premiumUpgradePrice: 80_000,
    pricingFootnote: "Тарифы оплачиваются один раз. Без подписки и скрытых платежей.",
  },
  directory: {
    enabled: true,
  },
};

async function getFeatureSetting(key, fallback = {}) {
  const normalizedKey = String(key || "");
  if (normalizedKey === "leaderboard") {
    const values = await getManySettings(["feature_leaderboard", "leaderboard_public_count"]);
    const base = DEFAULTS.leaderboard || {};
    return {
      ...base,
      ...fallback,
      enabled: values.feature_leaderboard ?? base.enabled,
      publicLimit: Number(values.leaderboard_public_count ?? base.publicLimit ?? 20),
      suspiciousThreshold: base.suspiciousThreshold,
      suspiciousWindowMinutes: base.suspiciousWindowMinutes,
    };
  }
  if (normalizedKey === "referrals") {
    const values = await getManySettings(["feature_referrals"]);
    const base = DEFAULTS.referrals || {};
    return {
      ...base,
      ...fallback,
      enabled: values.feature_referrals ?? base.enabled,
    };
  }
  if (normalizedKey === "directory") {
    const values = await getManySettings(["feature_directory"]);
    const base = DEFAULTS.directory || {};
    return {
      ...base,
      ...fallback,
      enabled: values.feature_directory ?? base.enabled,
    };
  }
  if (normalizedKey === "unqScore") {
    const values = await getManySettings(["feature_score_public"]);
    const base = DEFAULTS.unqScore || {};
    return {
      ...base,
      ...fallback,
      enabledOnCards: values.feature_score_public ?? base.enabledOnCards,
    };
  }

  if (!prisma.featureSetting || typeof prisma.featureSetting.findUnique !== "function") {
    const base = DEFAULTS[key] || {};
    return { ...base, ...fallback };
  }
  const row = await prisma.featureSetting.findUnique({ where: { key } });
  const base = DEFAULTS[key] || {};
  const payload = row && row.value && typeof row.value === "object" ? row.value : {};
  return { ...base, ...fallback, ...payload };
}

async function setFeatureSetting(key, value) {
  const normalizedKey = String(key || "");
  const nextValue = value && typeof value === "object" ? value : {};
  if (normalizedKey === "leaderboard") {
    await setSettingsBatch("platform", {
      feature_leaderboard: Boolean(nextValue.enabled),
      leaderboard_public_count: Number(nextValue.publicLimit || 20),
    });
    return getFeatureSetting("leaderboard");
  }
  if (normalizedKey === "referrals") {
    await setSettingsBatch("platform", {
      feature_referrals: nextValue.enabled === undefined ? true : Boolean(nextValue.enabled),
    });
    return getFeatureSetting("referrals");
  }
  if (normalizedKey === "directory") {
    await setSettingsBatch("platform", {
      feature_directory: nextValue.enabled === undefined ? true : Boolean(nextValue.enabled),
    });
    return getFeatureSetting("directory");
  }
  if (normalizedKey === "unqScore") {
    await setSettingsBatch("platform", {
      feature_score_public: nextValue.enabledOnCards === undefined ? true : Boolean(nextValue.enabledOnCards),
    });
    return getFeatureSetting("unqScore");
  }

  if (!prisma.featureSetting || typeof prisma.featureSetting.upsert !== "function") {
    const base = DEFAULTS[key] || {};
    return { ...base, ...(value && typeof value === "object" ? value : {}) };
  }
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
