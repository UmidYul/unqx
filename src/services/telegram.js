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
  const themeLabel = payload.themeLabel || "default_dark";
  const statusLabel = payload.statusLabel || "🆕 Новая";
  const text = [
    "🆕 <b>НОВАЯ ЗАЯВКА UNQ+</b>",
    "",
    `👤 <b>Имя:</b> ${escapeHtml(payload.name)}`,
    `🔗 <b>Slug:</b> ${escapeHtml(payload.slug)} (unqx.uz/${escapeHtml(payload.slug)})`,
    `💰 <b>Цена slug:</b> ${escapeHtml(payload.slugPriceLabel)} сум`,
    `📦 <b>Тариф:</b> ${tariffLabel} — ${escapeHtml(payload.tariffPriceLabel)} сум/мес`,
    `🎨 <b>Тема:</b> ${escapeHtml(themeLabel)}`,
    `📿 <b>Браслет:</b> ${braceletLabel}`,
    `📱 <b>Контакт:</b> ${escapeHtml(payload.contact)}`,
    `🧾 <b>Статус:</b> ${escapeHtml(statusLabel)}`,
    "",
    `💵 <b>Итого разово:</b> ${escapeHtml(payload.totalOneTimeLabel)} сум`,
    `🔄 <b>Ежемесячно:</b> ${escapeHtml(payload.tariffPriceLabel)} сум/мес`,
  ].join("\n");

  const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: "HTML",
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

module.exports = {
  TelegramConfigError,
  TelegramDeliveryError,
  sendOrderRequestToTelegram,
};
