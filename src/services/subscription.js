const SUBSCRIPTION_TERM_DAYS = 30;
const MS_IN_DAY = 24 * 60 * 60 * 1000;
const SUBSCRIPTION_TERM_MS = SUBSCRIPTION_TERM_DAYS * MS_IN_DAY;

function parseBoolean(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function addDays(date, days) {
  const base = toDate(date);
  if (!base) return null;
  return new Date(base.getTime() + Number(days || 0) * MS_IN_DAY);
}

function isSubscriptionAutoRenewEnabled(options = {}) {
  if (typeof options.autoRenew === "boolean") {
    return options.autoRenew;
  }
  return parseBoolean(process.env.SUBSCRIPTION_AUTO_RENEW_ENABLED) ?? true;
}

function normalizeSubscriptionPlan(plan) {
  const raw = String(plan || "")
    .trim()
    .toLowerCase();
  if (raw === "premium" || raw === "basic") return "premium";
  return "none";
}

function readUserDate(user, camelKey, snakeKey) {
  if (!user || typeof user !== "object") return null;
  return toDate(user[camelKey] ?? user[snakeKey]);
}

function hasSubscriptionHistoryEvidence(user) {
  return Boolean(
    readUserDate(user, "planPurchasedAt", "plan_purchased_at") ||
    readUserDate(user, "planUpgradedAt", "plan_upgraded_at") ||
    readUserDate(user, "subscriptionStartedAt", "subscription_started_at") ||
    readUserDate(user, "subscriptionExpiresAt", "subscription_expires_at") ||
    readUserDate(user, "subscriptionRenewedAt", "subscription_renewed_at"),
  );
}

function resolveSubscriptionDates(user) {
  const startedAt =
    readUserDate(user, "subscriptionStartedAt", "subscription_started_at") ||
    readUserDate(user, "planPurchasedAt", "plan_purchased_at");
  let expiresAt = readUserDate(user, "subscriptionExpiresAt", "subscription_expires_at");
  const renewedAt =
    readUserDate(user, "subscriptionRenewedAt", "subscription_renewed_at") ||
    readUserDate(user, "planUpgradedAt", "plan_upgraded_at");

  if (!expiresAt && startedAt) {
    expiresAt = addDays(startedAt, SUBSCRIPTION_TERM_DAYS);
  }

  return { startedAt, expiresAt, renewedAt };
}

function resolveEffectiveSubscriptionDates(user, options = {}) {
  const now = toDate(options.now) || new Date();
  const plan = normalizeSubscriptionPlan(options.planOverride ?? user?.plan);
  const raw = resolveSubscriptionDates(user);

  if (
    !isSubscriptionAutoRenewEnabled(options) ||
    plan !== "premium" ||
    !raw.expiresAt ||
    raw.expiresAt.getTime() > now.getTime()
  ) {
    return {
      ...raw,
      autoRenewed: false,
      autoRenewedPeriods: 0,
    };
  }

  const autoRenewedPeriods = Math.floor((now.getTime() - raw.expiresAt.getTime()) / SUBSCRIPTION_TERM_MS) + 1;
  const expiresAt = addDays(raw.expiresAt, autoRenewedPeriods * SUBSCRIPTION_TERM_DAYS);
  const renewedAt = addDays(raw.expiresAt, Math.max(0, autoRenewedPeriods - 1) * SUBSCRIPTION_TERM_DAYS) || now;

  return {
    startedAt: raw.startedAt,
    expiresAt,
    renewedAt,
    autoRenewed: true,
    autoRenewedPeriods,
  };
}

function getSubscriptionSnapshot(user, options = {}) {
  const now = toDate(options.now) || new Date();
  const plan = normalizeSubscriptionPlan(user?.plan);
  const { startedAt, expiresAt, renewedAt, autoRenewed, autoRenewedPeriods } =
    resolveEffectiveSubscriptionDates(user, { now, autoRenew: options.autoRenew });
  const hasPremium = plan === "premium";
  const isActive = hasPremium && (!expiresAt || expiresAt.getTime() > now.getTime());
  const isExpired = hasPremium && Boolean(expiresAt) && expiresAt.getTime() <= now.getTime();
  const daysLeft =
    isActive && expiresAt
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / MS_IN_DAY))
      : 0;

  return {
    plan,
    startedAt,
    expiresAt,
    renewedAt,
    isActive,
    isExpired,
    effectivePlan: isActive ? "premium" : "none",
    daysLeft,
    autoRenewed,
    autoRenewedPeriods,
  };
}

function isSubscriptionActive(user, options = {}) {
  return getSubscriptionSnapshot(user, options).isActive;
}

function isPublicProfileVisible(user, options = {}) {
  const status = String(user?.status || "")
    .trim()
    .toLowerCase();
  if (status !== "active") {
    return false;
  }

  const rawPlan = String(user?.plan || "")
    .trim()
    .toLowerCase();
  if (rawPlan !== "premium") {
    // Keep public pages and directory visible for non-premium users.
    return true;
  }

  return isSubscriptionActive(user, options);
}

function getSubscriptionRenewalWindow(user, options = {}) {
  const months = Math.max(1, Number(options.months || 1));
  const now = toDate(options.now) || new Date();
  const snapshot = getSubscriptionSnapshot(user, { now });
  const startAt =
    snapshot.expiresAt && snapshot.expiresAt.getTime() > now.getTime()
      ? snapshot.expiresAt
      : now;
  const endAt = addDays(startAt, months * SUBSCRIPTION_TERM_DAYS);
  return { startAt, endAt, months };
}

function buildSubscriptionRenewalPatch(user, options = {}) {
  const now = toDate(options.now) || new Date();
  const { startAt, endAt } = getSubscriptionRenewalWindow(user, options);
  const patch = {
    plan: "premium",
    subscriptionStartedAt:
      readUserDate(user, "subscriptionStartedAt", "subscription_started_at") ||
      readUserDate(user, "planPurchasedAt", "plan_purchased_at") ||
      now,
    subscriptionRenewedAt: now,
    subscriptionExpiresAt: endAt,
    planPurchasedAt: readUserDate(user, "planPurchasedAt", "plan_purchased_at") || startAt || now,
  };
  return patch;
}

function buildSubscriptionAutoRenewPatch(user, options = {}) {
  if (!isSubscriptionAutoRenewEnabled(options)) {
    return null;
  }

  const now = toDate(options.now) || new Date();
  const rawDates = resolveSubscriptionDates(user);
  const effectiveDates = resolveEffectiveSubscriptionDates(user, {
    now,
    autoRenew: true,
    planOverride: options.recoverPlan ? "premium" : undefined,
  });

  if (!effectiveDates.autoRenewed || !effectiveDates.expiresAt) {
    if (rawDates.expiresAt) {
      return null;
    }
    if (!rawDates.startedAt) {
      return null;
    }
  }

  const currentExpiresAt = rawDates.expiresAt;
  const nextExpiresAt = effectiveDates.expiresAt;
  if (
    currentExpiresAt &&
    nextExpiresAt &&
    currentExpiresAt.getTime() >= nextExpiresAt.getTime()
  ) {
    return null;
  }

  return {
    plan: "premium",
    subscriptionStartedAt: rawDates.startedAt || now,
    subscriptionRenewedAt: effectiveDates.renewedAt || now,
    subscriptionExpiresAt: nextExpiresAt || addDays(rawDates.startedAt || now, SUBSCRIPTION_TERM_DAYS),
    planPurchasedAt:
      readUserDate(user, "planPurchasedAt", "plan_purchased_at") ||
      rawDates.startedAt ||
      now,
  };
}

module.exports = {
  SUBSCRIPTION_TERM_DAYS,
  normalizeSubscriptionPlan,
  isSubscriptionAutoRenewEnabled,
  hasSubscriptionHistoryEvidence,
  getSubscriptionSnapshot,
  isSubscriptionActive,
  isPublicProfileVisible,
  getSubscriptionRenewalWindow,
  buildSubscriptionRenewalPatch,
  buildSubscriptionAutoRenewPatch,
};
