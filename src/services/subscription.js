const SUBSCRIPTION_TERM_DAYS = 30;
const MS_IN_DAY = 24 * 60 * 60 * 1000;

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

function getSubscriptionSnapshot(user, options = {}) {
  const now = toDate(options.now) || new Date();
  const plan = normalizeSubscriptionPlan(user?.plan);
  const { startedAt, expiresAt, renewedAt } = resolveSubscriptionDates(user);
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
  };
}

function isSubscriptionActive(user, options = {}) {
  return getSubscriptionSnapshot(user, options).isActive;
}

function isPublicProfileVisible(user, options = {}) {
  const status = String(user?.status || "")
    .trim()
    .toLowerCase();
  return status === "active" && isSubscriptionActive(user, options);
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

module.exports = {
  SUBSCRIPTION_TERM_DAYS,
  normalizeSubscriptionPlan,
  getSubscriptionSnapshot,
  isSubscriptionActive,
  isPublicProfileVisible,
  getSubscriptionRenewalWindow,
  buildSubscriptionRenewalPatch,
};
