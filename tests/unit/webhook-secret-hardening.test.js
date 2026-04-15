const fs = require("node:fs");
const path = require("node:path");

describe("webhook secret hardening", () => {
  test("payment and telegram webhooks fail closed in production and only accept header-based secrets", () => {
    const paymentsSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "payments.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const telegramSource = fs.readFileSync(path.join(process.cwd(), "src", "routes", "api", "telegram.js"), "utf-8")
      .replace(/\r\n/g, "\n");
    const secretsSource = fs.readFileSync(path.join(process.cwd(), "src", "utils", "secrets.js"), "utf-8")
      .replace(/\r\n/g, "\n");

    expect(secretsSource).toContain("timingSafeEqual");
    expect(secretsSource).toContain("function safeSecretEqual");

    expect(paymentsSource).toContain("function resolvePaymeWebhookAuthorization");
    expect(paymentsSource).toContain('authorized: env.NODE_ENV !== "production"');
    expect(paymentsSource).toContain("safeSecretEqual(candidate, configuredSecret)");
    expect(paymentsSource).toContain("normalizeAuthorizationSecret(req.get(\"authorization\"))");
    expect(paymentsSource).toContain("res.status(authState.misconfigured ? 503 : 401)");
    expect(paymentsSource).not.toContain("req.query?.secret");
    expect(paymentsSource).not.toContain("req.params?.secret");
    expect(paymentsSource).not.toContain("req.body?.secret");
    expect(paymentsSource).not.toContain('router.post("/payme/webhook/:secret"');

    expect(telegramSource).toContain("function resolveWebhookSecretState");
    expect(telegramSource).toContain('authorized: env.NODE_ENV !== "production"');
    expect(telegramSource).toContain("safeSecretEqual(candidate, configuredSecret)");
    expect(telegramSource).toContain("res.status(secretState.misconfigured ? 503 : 401)");
    expect(telegramSource).not.toContain("req.query?.secret");
    expect(telegramSource).not.toContain("req.params?.secret");
    expect(telegramSource).not.toContain('router.post("/webhook/:secret"');
  });
});
