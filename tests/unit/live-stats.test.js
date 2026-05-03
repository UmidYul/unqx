const bcrypt = require("bcryptjs");

process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync("test-password", 10);

const {
  getUtcDateKey,
  getUtcDayStart,
  normalizeTodayVisitorsAdjustment,
} = require("../../src/services/live-stats");

describe("live stats helpers", () => {
  test("utc day key and start use utc boundaries", () => {
    const now = new Date("2026-05-03T23:45:12.900Z");

    expect(getUtcDateKey(now)).toBe("2026-05-03");
    expect(getUtcDayStart(now).toISOString()).toBe("2026-05-03T00:00:00.000Z");
  });

  test("stale manual adjustment resets on a new utc day", () => {
    const nextDay = new Date("2026-05-03T08:00:00.000Z");

    expect(
      normalizeTodayVisitorsAdjustment({ date: "2026-05-02", amount: 99 }, nextDay),
    ).toEqual({ date: "2026-05-03", amount: 0 });
  });

  test("current-day manual adjustment stays non-negative integer", () => {
    const now = new Date("2026-05-03T08:00:00.000Z");

    expect(
      normalizeTodayVisitorsAdjustment({ date: "2026-05-03", amount: 12.8 }, now),
    ).toEqual({ date: "2026-05-03", amount: 12 });
    expect(
      normalizeTodayVisitorsAdjustment({ date: "2026-05-03", amount: -5 }, now),
    ).toEqual({ date: "2026-05-03", amount: 0 });
  });
});
