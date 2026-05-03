const { prisma } = require("../db/prisma");
const { getSetting, setSettingsBatch } = require("./platform-settings");

const SYNTHETIC_FINGERPRINT_PREFIX = "synthetic:";
const TODAY_VISITORS_ADJUSTMENT_KEY = "platform_today_visitors_adjustment";

function getUtcDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getUtcDayStart(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function normalizeTodayVisitorsAdjustment(value, now = new Date()) {
  const dateKey = getUtcDateKey(now);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { date: dateKey, amount: 0 };
  }

  const storedDate = String(value.date || "").trim();
  const parsedAmount = Number(value.amount);
  const amount = Number.isFinite(parsedAmount) ? Math.max(0, Math.floor(parsedAmount)) : 0;
  if (storedDate !== dateKey) {
    return { date: dateKey, amount: 0 };
  }

  return { date: dateKey, amount };
}

async function countUniqueVisitorsSince(sinceDate) {
  if (!prisma.analyticsView) return 0;
  try {
    const rows = await prisma.analyticsView.findMany({
      where: { visitedAt: { gte: sinceDate } },
      select: { sessionId: true, fingerprint: true },
    });
    return new Set(
      rows
        .filter((row) => !String(row.fingerprint || "").startsWith(SYNTHETIC_FINGERPRINT_PREFIX))
        .map((row) => String(row.sessionId || "").trim())
        .filter(Boolean),
    ).size;
  } catch (error) {
    const knownColumnErrors = new Set(["P2021", "P2022", "42703"]);
    if (!knownColumnErrors.has(String(error?.code || ""))) {
      throw error;
    }
    const rows = await prisma.analyticsView.findMany({
      where: { visitedAt: { gte: sinceDate } },
      select: { sessionId: true },
    });
    return new Set(rows.map((row) => String(row.sessionId || "").trim()).filter(Boolean)).size;
  }
}

async function getTodayVisitorsStats(now = new Date()) {
  const [raw, storedAdjustment] = await Promise.all([
    countUniqueVisitorsSince(getUtcDayStart(now)),
    getSetting(TODAY_VISITORS_ADJUSTMENT_KEY, { date: "", amount: 0 }),
  ]);
  const adjustmentState = normalizeTodayVisitorsAdjustment(storedAdjustment, now);
  return {
    dateKey: adjustmentState.date,
    raw,
    adjustment: adjustmentState.amount,
    total: raw + adjustmentState.amount,
  };
}

async function incrementTodayVisitorsAdjustment(delta, updatedBy = "system", now = new Date()) {
  const parsedDelta = Number(delta);
  if (!Number.isFinite(parsedDelta) || parsedDelta < 1) {
    const error = new Error("Amount must be a positive integer");
    error.code = "TODAY_VISITORS_DELTA_INVALID";
    throw error;
  }

  const current = normalizeTodayVisitorsAdjustment(
    await getSetting(TODAY_VISITORS_ADJUSTMENT_KEY, { date: "", amount: 0 }),
    now,
  );
  const next = {
    date: getUtcDateKey(now),
    amount: Math.min(Number.MAX_SAFE_INTEGER, current.amount + Math.floor(parsedDelta)),
  };

  await setSettingsBatch("platform", { [TODAY_VISITORS_ADJUSTMENT_KEY]: next }, updatedBy);
  const raw = await countUniqueVisitorsSince(getUtcDayStart(now));
  return {
    dateKey: next.date,
    raw,
    adjustment: next.amount,
    total: raw + next.amount,
  };
}

module.exports = {
  TODAY_VISITORS_ADJUSTMENT_KEY,
  countUniqueVisitorsSince,
  getTodayVisitorsStats,
  getUtcDateKey,
  getUtcDayStart,
  incrementTodayVisitorsAdjustment,
  normalizeTodayVisitorsAdjustment,
};
