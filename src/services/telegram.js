const { env } = require("../config/env");

class TelegramConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "TelegramConfigError";
  }
}

class TelegramDeliveryError extends Error {
  constructor(message) {
    super(message);
    this.name = "TelegramDeliveryError";
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendOrderRequestToTelegram(payload) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    throw new TelegramConfigError("Telegram credentials are not configured");
  }

  const tariffLabel = payload.tariff === "premium" ? "ПРЕМИУМ" : "БАЗОВЫЙ";
  const braceletLabel = payload.bracelet ? "Да (+300 000 сум)" : "Нет";
  const usernameLabel = payload.username ? `@${escapeHtml(payload.username.replace(/^@/, ""))}` : "@—";
  const telegramLink = payload.telegramId ? `tg://user?id=${escapeHtml(payload.telegramId)}` : "—";
  const text = [
    "<b>НОВАЯ ЗАЯВКА UNQ+</b>",
    "",
    `${escapeHtml(payload.name)} · ${usernameLabel} · ${telegramLink}`,
    `<b>Slug:</b> ${escapeHtml(payload.slug)} · unqx.uz/${escapeHtml(payload.slug)}`,
    `<b>Цена slug:</b> ${escapeHtml(payload.slugPriceLabel)} сум`,
    `<b>Тариф:</b> ${tariffLabel} · ${escapeHtml(payload.tariffPriceLabel)} сум`,
    `<b>Браслет:</b> ${braceletLabel}`,
    "",
    `<b>Итого разово:</b> ${escapeHtml(payload.totalOneTimeLabel)} сум`,
    "Единоразовая покупка",
    "",
    "Срок резерва заявки: 24 часа",
  ]
    .filter(Boolean)
    .join("\n");

  return sendTelegramMessage({
    chatId: env.TELEGRAM_CHAT_ID,
    text,
    parseMode: "HTML",
  });
}

async function sendTelegramMessage({ chatId, text, parseMode = "HTML" }) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new TelegramConfigError("Telegram bot token is not configured");
  }
  if (!chatId) {
    throw new TelegramConfigError("Telegram chat id is not configured");
  }

  const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: parseMode,
    }),
  });

  if (!response.ok) {
    throw new TelegramDeliveryError(`Telegram API returned ${response.status}`);
  }

  const body = await response.json();
  if (!body || body.ok !== true) {
    throw new TelegramDeliveryError("Telegram API returned non-ok payload");
  }

  return body;
}

async function sendSlugApprovedToUser({ telegramId, slug, plan, hasBracelet = false }) {
  const planLabel = plan === "premium" ? "Премиум" : "Базовый";
  const completionLine = hasBracelet ? "Slug и браслет — всё готово." : "";
  const text = [
    "Заявка одобрена.",
    "",
    `Slug: unqx.uz/${slug}`,
    `Тариф: ${planLabel} — активирован навсегда.`,
    completionLine,
    "",
    "Войди в профиль и создай свою визитку:",
    "unqx.uz/profile",
  ].join("\n");
  return sendTelegramMessage({ chatId: telegramId, text, parseMode: "HTML" });
}

async function sendSlugAwaitingPaymentToUser({ telegramId, slug }) {
  const text = `Оплата по заявке ${slug} подтверждена.\nСкоро активируем UNQ.`;
  return sendTelegramMessage({ chatId: telegramId, text, parseMode: "HTML" });
}

async function sendSlugRejectedToUser({ telegramId, slug, adminNote }) {
  const reason = String(adminNote || "").trim() || "Без указания причины";
  const text = `Заявка на ${slug} отклонена.\nПричина: ${escapeHtml(reason)}.\nНапиши нам если есть вопросы.`;
  return sendTelegramMessage({ chatId: telegramId, text, parseMode: "HTML" });
}

async function sendSlugExpiredToUser({ telegramId, slug }) {
  const text = `Заявка на ${slug} истекла — не успели связаться.\nSlug снова доступен. Подай заявку повторно: unqx.uz`;
  return sendTelegramMessage({ chatId: telegramId, text, parseMode: "HTML" });
}

async function sendVerificationRequestToAdmin(payload) {
  if (!env.TELEGRAM_CHAT_ID) {
    throw new TelegramConfigError("Telegram chat id is not configured");
  }
  const text = [
    "Новая заявка на верификацию",
    "",
    `Telegram ID: ${escapeHtml(payload.telegramId)}`,
    `Slug: ${escapeHtml(payload.slug)}`,
    `Компания: ${escapeHtml(payload.companyName)}`,
    `Роль: ${escapeHtml(payload.role)}`,
    `Подтверждение: ${escapeHtml(payload.proofType)} · ${escapeHtml(payload.proofValue)}`,
    payload.comment ? `Комментарий: ${escapeHtml(payload.comment)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return sendTelegramMessage({ chatId: env.TELEGRAM_CHAT_ID, text, parseMode: "HTML" });
}

async function sendVerificationStatusToUser({ telegramId, status, adminNote }) {
  const note = String(adminNote || "").trim();
  const text =
    status === "approved"
      ? "Верификация UNQ+ подтверждена. Значок верификации уже активен."
      : `Верификация UNQ+ отклонена.${note ? `\nПричина: ${escapeHtml(note)}` : ""}`;
  return sendTelegramMessage({ chatId: telegramId, text, parseMode: "HTML" });
}

module.exports = {
  TelegramConfigError,
  TelegramDeliveryError,
  sendOrderRequestToTelegram,
  sendTelegramMessage,
  sendSlugApprovedToUser,
  sendSlugAwaitingPaymentToUser,
  sendSlugRejectedToUser,
  sendSlugExpiredToUser,
  sendVerificationRequestToAdmin,
  sendVerificationStatusToUser,
};

