const path = require("node:path");
const fs = require("node:fs");

describe("today visitors admin wiring", () => {
  test("connects public stats, admin increment endpoint, and dashboard control", () => {
    const platformSettingsSource = fs.readFileSync(path.join(process.cwd(), "src", "services", "platform-settings.js"), "utf-8");
    const featuresSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "features.js"), "utf-8");
    const adminSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "admin.js"), "utf-8");
    const dashboardSource = fs.readFileSync(path.join(process.cwd(), "public", "js", "admin-dashboard.js"), "utf-8");

    expect(platformSettingsSource).toContain('key: "platform_today_visitors_adjustment"');
    expect(featuresSource).toContain("getTodayVisitorsStats");
    expect(featuresSource).toContain("todayVisitors: todayVisitorsStats.total");
    expect(adminSource).toContain('"/analytics/today-visitors/increment"');
    expect(adminSource).toContain("incrementTodayVisitorsAdjustment");
    expect(dashboardSource).toContain("analytics-visitors-adjust-form");
    expect(dashboardSource).toContain("/api/admin/analytics/today-visitors/increment");
  });
});
