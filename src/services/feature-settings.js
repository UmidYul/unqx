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
    planPremiumMonthlyPriceUsd: 2,
    planPremiumMonthlyPriceUzs: 130_000,
    planBasicPrice: 130_000,
    planPremiumPrice: 130_000,
    premiumUpgradePrice: 130_000,
    pricingFootnote: "Premium subscription is billed monthly.",
  },
  directory: {
    enabled: true,
  },
};

async function getFeatureSetting(key, fallback = {}) {
  const normalizedKey = String(key || "");
  if (normalizedKey === "leaderboard") {
    const values = await getManySettings([
      "feature_leaderboard",
      "leaderboard_public_count",
      "leaderboard_suspicious_threshold",
      "leaderboard_suspicious_window_minutes",
    ]);
    const base = DEFAULTS.leaderboard || {};
    const fallbackThreshold =
      fallback && Object.prototype.hasOwnProperty.call(fallback, "suspiciousThreshold")
        ? Number(fallback.suspiciousThreshold)
        : NaN;
    const fallbackWindow =
      fallback && Object.prototype.hasOwnProperty.call(fallback, "suspiciousWindowMinutes")
        ? Number(fallback.suspiciousWindowMinutes)
        : NaN;
    const suspiciousThreshold = Math.max(
      1,
      Number(values.leaderboard_suspicious_threshold ?? fallbackThreshold ?? base.suspiciousThreshold ?? 50) || 50,
    );
    const suspiciousWindowMinutes = Math.max(
      1,
      Number(values.leaderboard_suspicious_window_minutes ?? fallbackWindow ?? base.suspiciousWindowMinutes ?? 10) || 10,
    );
    return {
      ...base,
      ...fallback,
      enabled: values.feature_leaderboard ?? base.enabled,
      publicLimit: Number(values.leaderboard_public_count ?? base.publicLimit ?? 20),
      suspiciousThreshold,
      suspiciousWindowMinutes,
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

  const base = DEFAULTS[key] || {};
  return { ...base, ...fallback };
}

async function setFeatureSetting(key, value) {
  const normalizedKey = String(key || "");
  const nextValue = value && typeof value === "object" ? value : {};
  if (normalizedKey === "leaderboard") {
    await setSettingsBatch("platform", {
      feature_leaderboard: Boolean(nextValue.enabled),
      leaderboard_public_count: Number(nextValue.publicLimit || 20),
      leaderboard_suspicious_threshold: Math.max(1, Number(nextValue.suspiciousThreshold || 50)),
      leaderboard_suspicious_window_minutes: Math.max(1, Number(nextValue.suspiciousWindowMinutes || 10)),
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

  const base = DEFAULTS[key] || {};
  const next = { ...base, ...(value && typeof value === "object" ? value : {}) };
  return next;
}

module.exports = {
  DEFAULTS,
  getFeatureSetting,
  setFeatureSetting,
};
