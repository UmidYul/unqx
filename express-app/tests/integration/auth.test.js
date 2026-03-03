const request = require("supertest");

const runIntegration = process.env.INTEGRATION_RUN === "1";
const createApp = runIntegration ? require("../../src/app").createApp : null;
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration("integration auth smoke", () => {
  test("redirects protected page to /admin when not authenticated", async () => {
    const app = createApp();
    const response = await request(app).get("/admin/dashboard");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin");
  });

  test("returns 401 for protected admin API when not authenticated", async () => {
    const app = createApp();
    const response = await request(app).get("/api/admin/cards");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });
});
