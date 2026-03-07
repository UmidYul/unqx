const request = require("supertest");

const runIntegration = process.env.INTEGRATION_RUN === "1";
const createApp = runIntegration ? require("../../src/app").createApp : null;
const prisma = runIntegration ? require("../../src/db/prisma").prisma : null;
const describeIntegration = runIntegration ? describe : describe.skip;

function extractSessionSid(setCookieHeader) {
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [];
  const sessionCookie = cookies.find((item) => typeof item === "string" && item.startsWith("unqx.sid="));
  if (!sessionCookie) return "";

  const firstChunk = sessionCookie.split(";")[0] || "";
  const encoded = firstChunk.slice("unqx.sid=".length);
  const decoded = decodeURIComponent(encoded);
  if (decoded.startsWith("s:")) {
    const dotIndex = decoded.lastIndexOf(".");
    return dotIndex > 2 ? decoded.slice(2, dotIndex) : decoded.slice(2);
  }
  return decoded;
}

describeIntegration("integration auth smoke", () => {
  test("redirects protected page to /admin when not authenticated", async () => {
    const app = createApp();
    const response = await request(app).get("/admin/dashboard");

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/login");
  });

  test("returns 401 for protected admin API when not authenticated", async () => {
    const app = createApp();
    const response = await request(app).get("/api/admin/cards");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  test("redirects /profile to home when user is not authenticated", async () => {
    const app = createApp();
    const response = await request(app).get("/profile");

    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("/login?next=%2Fprofile");
  });

  test("clears stale user session on /profile and breaks redirect loop", async () => {
    const app = createApp();
    const agent = request.agent(app);

    const loginPageResponse = await agent.get("/login");
    expect(loginPageResponse.status).toBe(200);

    const sid = extractSessionSid(loginPageResponse.headers["set-cookie"]);
    expect(sid).toBeTruthy();

    const staleUser = {
      userId: "00000000-0000-0000-0000-000000000000",
      emailVerified: true,
      firstName: "Stale",
      status: "active",
      plan: "none",
    };

    const updated = await prisma.$executeRawUnsafe(
      `
      UPDATE user_sessions
      SET
        sess = (COALESCE(sess::jsonb, '{}'::jsonb) || jsonb_build_object('user', $2::jsonb))::json,
        expire = NOW() + interval '1 day'
      WHERE sid = $1
      `,
      sid,
      JSON.stringify(staleUser),
    );
    expect(Number(updated)).toBeGreaterThan(0);

    const profileResponse = await agent.get("/profile");
    expect(profileResponse.status).toBe(302);
    expect(profileResponse.headers.location).toBe("/login");

    const nextLoginResponse = await agent.get("/login");
    expect(nextLoginResponse.status).toBe(200);
    expect(nextLoginResponse.text).toContain('id="login-form"');
  });
});
