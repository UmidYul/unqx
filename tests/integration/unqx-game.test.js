const { randomUUID } = require("node:crypto");
const request = require("supertest");

const runIntegration = process.env.INTEGRATION_RUN === "1";
const createApp = runIntegration ? require("../../src/app").createApp : null;
const prisma = runIntegration ? require("../../src/db/prisma").prisma : null;
const describeIntegration = runIntegration ? describe : describe.skip;

function randomSlug() {
  const letters = Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join("");
  const digits = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
  return `${letters}${digits}`;
}

function splitSlug(slug) {
  const normalized = String(slug || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (!/^[A-Z]{3}[0-9]{3}$/.test(normalized)) {
    return null;
  }
  return {
    slug: normalized,
    letters: normalized.slice(0, 3),
    digits: normalized.slice(3),
  };
}

function buildOrderPayload(slug) {
  const parsed = splitSlug(slug);
  if (!parsed) return null;
  return {
    name: "Lucky Buyer",
    letters: parsed.letters,
    digits: parsed.digits,
    tariff: "premium",
    theme: "default_dark",
    products: {
      digitalCard: true,
      bracelet: false,
    },
  };
}

async function findAvailableSlug(app, excludeSlug = "") {
  const excluded = String(excludeSlug || "").trim().toUpperCase();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const candidate = randomSlug();
    if (candidate === excluded) continue;
    const response = await request(app).get(`/api/cards/availability?slug=${candidate}&source=integration`);
    if (response.status !== 200) continue;
    if (response.body?.validFormat && response.body?.available) {
      return candidate;
    }
  }
  throw new Error("Failed to resolve available slug for integration test");
}

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

function extractCsrfToken(html) {
  const match = String(html || "").match(/name="csrf-token"\s+content="([^"]+)"/i);
  return match ? String(match[1] || "") : "";
}

async function createAuthenticatedAgent(app) {
  const agent = request.agent(app);
  const loginPageResponse = await agent.get("/login");
  expect(loginPageResponse.status).toBe(200);

  const sid = extractSessionSid(loginPageResponse.headers["set-cookie"]);
  const csrfToken = extractCsrfToken(loginPageResponse.text);
  expect(sid).toBeTruthy();
  expect(csrfToken).toBeTruthy();

  const userId = randomUUID();
  await prisma.user.upsert({
    where: { id: userId },
    update: {
      firstName: "UnqxGame",
      status: "active",
      plan: "none",
      emailVerified: true,
    },
    create: {
      id: userId,
      firstName: "UnqxGame",
      status: "active",
      plan: "none",
      emailVerified: true,
    },
  });

  const sessionUser = {
    userId,
    emailVerified: true,
    firstName: "UnqxGame",
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
    JSON.stringify(sessionUser),
  );
  expect(Number(updated)).toBeGreaterThan(0);

  return { agent, userId, csrfToken };
}

describeIntegration("unqx game integration", () => {
  test("redirects /unqx-game to login when not authenticated", async () => {
    const app = createApp();
    const response = await request(app).get("/unqx-game");
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain("/login?next=%2Funqx-game");
  });

  test("returns 401 for spin endpoint when not authenticated", async () => {
    const app = createApp();
    const response = await request(app).post("/api/cards/unqx-game/spin").send({});
    expect(response.status).toBe(401);
    expect(response.body?.code).toBe("AUTH_REQUIRED");
  });

  test("creates spin entry and returns valid payload for authenticated user", async () => {
    const app = createApp();
    const { agent, userId, csrfToken } = await createAuthenticatedAgent(app);
    const createdIds = [];

    try {
      const response = await agent
        .post("/api/cards/unqx-game/spin")
        .set("x-csrf-token", csrfToken)
        .send({});

      expect(response.status).toBe(200);
      expect(response.body?.ok).toBe(true);
      expect(response.body?.entry?.slug).toMatch(/^[A-Z]{3}[0-9]{3}$/);
      expect(Number.isFinite(Number(response.body?.entry?.price))).toBe(true);
      expect(Number(response.body?.lucky?.discountPercent)).toBe(10);
      expect(String(response.body?.lucky?.targetSlug || "")).toBe(String(response.body?.entry?.slug || ""));
      expect(typeof response.body?.lucky?.validUntil).toBe("string");

      const entryId = String(response.body?.entry?.id || "");
      expect(entryId).toBeTruthy();
      createdIds.push(entryId);

      const dbEntry = await prisma.unqxGameSpin.findUnique({
        where: { id: entryId },
      });
      expect(dbEntry).toBeTruthy();
      expect(dbEntry.userId).toBe(userId);
    } finally {
      if (createdIds.length) {
        await prisma.unqxGameSpin.deleteMany({ where: { id: { in: createdIds } } });
      }
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  test("returns 429 with nextSpinAt for second spin on same day", async () => {
    const app = createApp();
    const { agent, userId, csrfToken } = await createAuthenticatedAgent(app);

    try {
      const first = await agent.post("/api/cards/unqx-game/spin").set("x-csrf-token", csrfToken).send({});
      expect(first.status).toBe(200);

      const second = await agent.post("/api/cards/unqx-game/spin").set("x-csrf-token", csrfToken).send({});
      expect(second.status).toBe(429);
      expect(second.body?.code).toBe("DAILY_SPIN_LIMIT");
      expect(typeof second.body?.nextSpinAt).toBe("string");
    } finally {
      await prisma.unqxGameSpin.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  test("returns history sorted by createdAt desc and respects limit", async () => {
    const app = createApp();
    const { agent, userId } = await createAuthenticatedAgent(app);

    const older = await prisma.unqxGameSpin.create({
      data: {
        userId,
        slug: "AAA111",
        price: 100000,
        createdAt: new Date("2099-01-01T10:00:00.000Z"),
      },
    });
    const newer = await prisma.unqxGameSpin.create({
      data: {
        userId,
        slug: "BBB222",
        price: 200000,
        createdAt: new Date("2099-01-01T10:00:01.000Z"),
      },
    });

    try {
      const response = await agent.get("/api/cards/unqx-game/history?limit=1");
      expect(response.status).toBe(200);
      expect(response.body?.ok).toBe(true);
      expect(Array.isArray(response.body?.items)).toBe(true);
      expect(response.body.items.length).toBe(1);
      expect(response.body.items[0].id).toBe(newer.id);
      expect(response.body.items[0].winner).toBeTruthy();
      expect(typeof response.body.items[0].winner.name).toBe("string");

      const responseAll = await agent.get("/api/cards/unqx-game/history?limit=2");
      expect(responseAll.status).toBe(200);
      expect(responseAll.body.items.length).toBe(2);
      expect(responseAll.body.items[0].id).toBe(newer.id);
      expect(responseAll.body.items[1].id).toBe(older.id);
      expect(Object.prototype.hasOwnProperty.call(responseAll.body.items[0].winner, "profileSlug")).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(responseAll.body.items[0].winner, "profileUrl")).toBe(true);
    } finally {
      await prisma.unqxGameSpin.deleteMany({ where: { id: { in: [older.id, newer.id] } } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  test("applies lucky discount for matching lucky slug in order request", async () => {
    const app = createApp();
    const { agent, userId, csrfToken } = await createAuthenticatedAgent(app);

    let luckySlug = "";
    try {
      const spin = await agent.post("/api/cards/unqx-game/spin").set("x-csrf-token", csrfToken).send({});
      expect(spin.status).toBe(200);
      luckySlug = String(spin.body?.entry?.slug || "");
      expect(/^[A-Z]{3}[0-9]{3}$/.test(luckySlug)).toBe(true);

      const payload = buildOrderPayload(luckySlug);
      expect(payload).toBeTruthy();

      const order = await agent.post("/api/cards/order-request").set("x-csrf-token", csrfToken).send(payload);
      expect(order.status).toBe(200);
      expect(order.body?.ok).toBe(true);
      expect(Number(order.body?.pricing?.luckyDiscountApplied || 0)).toBeGreaterThan(0);
      expect(Number(order.body?.pricing?.slugPriceBeforeLucky || 0)).toBeGreaterThan(Number(order.body?.pricing?.slugPrice || 0));
    } finally {
      await prisma.slugRequest.deleteMany({ where: { userId } });
      if (luckySlug) {
        await prisma.slug.deleteMany({ where: { fullSlug: luckySlug } });
      }
      await prisma.unqxGameSpin.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });

  test("does not apply lucky discount for non-matching slug in order request", async () => {
    const app = createApp();
    const { agent, userId, csrfToken } = await createAuthenticatedAgent(app);

    let requestedSlug = "";
    try {
      const spin = await agent.post("/api/cards/unqx-game/spin").set("x-csrf-token", csrfToken).send({});
      expect(spin.status).toBe(200);
      const luckySlug = String(spin.body?.entry?.slug || "");
      expect(/^[A-Z]{3}[0-9]{3}$/.test(luckySlug)).toBe(true);

      requestedSlug = await findAvailableSlug(app, luckySlug);
      const payload = buildOrderPayload(requestedSlug);
      expect(payload).toBeTruthy();

      const order = await agent.post("/api/cards/order-request").set("x-csrf-token", csrfToken).send(payload);
      expect(order.status).toBe(200);
      expect(order.body?.ok).toBe(true);
      expect(Number(order.body?.pricing?.luckyDiscountApplied || 0)).toBe(0);
    } finally {
      await prisma.slugRequest.deleteMany({ where: { userId } });
      if (requestedSlug) {
        await prisma.slug.deleteMany({ where: { fullSlug: requestedSlug } });
      }
      await prisma.unqxGameSpin.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
  });
});
