const { createHash, createHmac } = require("node:crypto");

const { env } = require("../../src/config/env");
const { TelegramAuthError, verifyTelegramLoginPayload } = require("../../src/services/telegram-auth");

function signPayload(payload, token) {
  const entries = Object.entries(payload)
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b));
  const dataCheck = entries.map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = createHash("sha256").update(token).digest();
  return createHmac("sha256", secret).update(dataCheck).digest("hex");
}

describe("telegram auth verify", () => {
  const previousToken = env.TELEGRAM_BOT_TOKEN;
  const previousMaxAge = env.TELEGRAM_AUTH_MAX_AGE_SECONDS;

  beforeAll(() => {
    env.TELEGRAM_BOT_TOKEN = "123456:test_token_for_unit";
    env.TELEGRAM_AUTH_MAX_AGE_SECONDS = 3600;
  });

  afterAll(() => {
    env.TELEGRAM_BOT_TOKEN = previousToken;
    env.TELEGRAM_AUTH_MAX_AGE_SECONDS = previousMaxAge;
  });

  test("accepts valid payload", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      id: "12345",
      first_name: "Alice",
      last_name: "Doe",
      username: "alice_d",
      photo_url: "https://t.me/i/userpic/320/alice.jpg",
      auth_date: String(now),
    };
    payload.hash = signPayload(payload, env.TELEGRAM_BOT_TOKEN);

    const result = verifyTelegramLoginPayload(payload);
    expect(result.telegramId).toBe("12345");
    expect(result.firstName).toBe("Alice");
  });

  test("rejects invalid hash", () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      id: "12345",
      first_name: "Alice",
      auth_date: String(now),
      hash: "0".repeat(64),
    };

    expect(() => verifyTelegramLoginPayload(payload)).toThrow(TelegramAuthError);
  });

  test("rejects expired payload", () => {
    const old = Math.floor(Date.now() / 1000) - 7200;
    const payload = {
      id: "12345",
      first_name: "Alice",
      auth_date: String(old),
    };
    payload.hash = signPayload(payload, env.TELEGRAM_BOT_TOKEN);

    expect(() => verifyTelegramLoginPayload(payload)).toThrow(TelegramAuthError);
  });
});
