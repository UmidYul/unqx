const { env } = require("../config/env");

function isPublicHttpsAppUrl(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    if (url.protocol !== "https:") return false;
    const host = String(url.hostname || "").toLowerCase();
    if (!host) return false;
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeWebhookUrl(baseUrl) {
  return `${String(baseUrl || "").replace(/\/$/, "")}/api/telegram/webhook`;
}

async function telegramApiCall(method, payload = {}) {
  const token = String(env.TELEGRAM_BOT_TOKEN || "").trim();
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }
  const endpoint = `https://api.telegram.org/bot${token}/${method}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok !== true) {
    const description = body?.description ? String(body.description) : `HTTP ${response.status}`;
    throw new Error(`Telegram ${method} failed: ${description}`);
  }
  return body.result;
}

function sameWebhookUrl(current, expected) {
  return String(current || "").replace(/\/$/, "") === String(expected || "").replace(/\/$/, "");
}

async function ensureTelegramWebhook() {
  const token = String(env.TELEGRAM_BOT_TOKEN || "").trim();
  const appUrl = String(env.APP_URL || "").trim();
  const secret = String(env.TELEGRAM_WEBHOOK_SECRET || "").trim();

  if (!token) {
    console.warn("[telegram-webhook] skip setup: TELEGRAM_BOT_TOKEN is missing");
    return { ok: false, skipped: true, reason: "missing_token" };
  }
  if (!appUrl) {
    console.warn("[telegram-webhook] skip setup: APP_URL is missing");
    return { ok: false, skipped: true, reason: "missing_app_url" };
  }
  if (!isPublicHttpsAppUrl(appUrl)) {
    console.warn("[telegram-webhook] skip setup: APP_URL must be public https URL", { appUrl });
    return { ok: false, skipped: true, reason: "invalid_app_url" };
  }

  const botInfo = await telegramApiCall("getMe");
  console.info("[telegram-webhook] bot identity", {
    id: botInfo?.id || null,
    username: botInfo?.username ? `@${botInfo.username}` : null,
  });

  const expectedUrl = normalizeWebhookUrl(appUrl);
  const webhookInfo = await telegramApiCall("getWebhookInfo");
  const currentUrl = String(webhookInfo?.url || "");
  const currentAllowedUpdates = Array.isArray(webhookInfo?.allowed_updates) ? webhookInfo.allowed_updates : [];
  const hasCallbackUpdates =
    currentAllowedUpdates.length === 0 || currentAllowedUpdates.includes("callback_query");
  const forceSetForSecretSync = Boolean(secret);

  const shouldUpdate = !sameWebhookUrl(currentUrl, expectedUrl) || !hasCallbackUpdates || forceSetForSecretSync;

  if (!shouldUpdate) {
    console.info("[telegram-webhook] webhook is up to date", {
      url: currentUrl,
      pendingUpdates: Number(webhookInfo?.pending_update_count || 0),
      lastErrorDate: webhookInfo?.last_error_date || null,
      lastErrorMessage: webhookInfo?.last_error_message || null,
    });
    return { ok: true, updated: false, url: currentUrl };
  }

  const payload = {
    url: expectedUrl,
    allowed_updates: ["callback_query"],
    drop_pending_updates: false,
  };
  if (secret) {
    payload.secret_token = secret;
  }

  await telegramApiCall("setWebhook", payload);
  const after = await telegramApiCall("getWebhookInfo");
  console.info("[telegram-webhook] webhook updated", {
    url: expectedUrl,
    withSecret: Boolean(secret),
    pendingUpdates: Number(after?.pending_update_count || 0),
    lastErrorDate: after?.last_error_date || null,
    lastErrorMessage: after?.last_error_message || null,
  });
  return { ok: true, updated: true, url: expectedUrl };
}

module.exports = {
  ensureTelegramWebhook,
};
