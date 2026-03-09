const express = require("express");

const { asyncHandler } = require("../../middleware/async");
const { env } = require("../../config/env");
const { prisma } = require("../../db/prisma");
const { getSetting } = require("../../services/platform-settings");
const { sendTelegramCallbackAnswer } = require("../../services/telegram");
const { applyOrderStatusTransition } = require("../../services/order-status-transition");

const router = express.Router();
const CALLBACK_TTL_MS = 1000 * 60 * 30;
const processedCallbacks = new Map();

function normalizeTelegramAction(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "contacted") return "contacted";
  if (normalized === "paid") return "paid";
  if (normalized === "approved") return "approved";
  return null;
}

function canApplyTelegramStatus(currentStatus, nextStatus) {
  const current = String(currentStatus || "").toLowerCase();
  if (!["new", "contacted", "paid"].includes(current)) {
    return false;
  }
  if (nextStatus === "contacted") {
    return current === "new";
  }
  if (nextStatus === "paid") {
    return current === "new" || current === "contacted";
  }
  if (nextStatus === "approved") {
    return current === "paid";
  }
  return false;
}

function parseOrderAction(value) {
  const match = String(value || "").match(/^ord:(contacted|paid|approved):([a-z0-9-]{1,128})$/i);
  if (!match) return null;
  return {
    action: normalizeTelegramAction(match[1]),
    orderId: String(match[2]),
  };
}

function isWebhookSecretValid(req) {
  const configuredSecret = String(env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (!configuredSecret) {
    return true;
  }

  const headerSecret = String(req.get("x-telegram-bot-api-secret-token") || "").trim();
  const querySecret = String(req.query?.secret || "").trim();
  const pathSecret = String(req.params?.secret || "").trim();

  return headerSecret === configuredSecret || querySecret === configuredSecret || pathSecret === configuredSecret;
}

function cleanupProcessedCallbacks() {
  const now = Date.now();
  for (const [callbackId, at] of processedCallbacks.entries()) {
    if (!Number.isFinite(at) || now - at > CALLBACK_TTL_MS) {
      processedCallbacks.delete(callbackId);
    }
  }
}

function normalizeTelegramHandle(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  return raw.replace(/^@+/, "");
}

function normalizeTelegramChatNumeric(value) {
  const raw = String(value || "").trim();
  if (!raw || !/^-?\d+$/.test(raw)) return "";
  const abs = raw.replace(/^-/, "");
  return abs.startsWith("100") ? abs.slice(3) : abs;
}

async function isAllowedAdminChat(chat) {
  const configured = String(await getSetting("contact_telegram_chat_id", "")).trim();
  const fallback = String(env.TELEGRAM_CHAT_ID || "").trim();
  const allowedRaw = configured || fallback;
  if (!allowedRaw) return true;

  const allowedChats = allowedRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allowedChats.length) return true;

  const chatId = String(chat?.id || "").trim();
  const chatHandle = normalizeTelegramHandle(chat?.username);
  const chatNumeric = normalizeTelegramChatNumeric(chatId);

  return allowedChats.some((allowed) => {
    const allowedRawValue = String(allowed || "").trim();
    if (!allowedRawValue) return false;

    if (allowedRawValue.startsWith("@")) {
      const allowedHandle = normalizeTelegramHandle(allowedRawValue);
      return Boolean(chatHandle) && allowedHandle === chatHandle;
    }

    if (chatId && allowedRawValue === chatId) {
      return true;
    }

    const allowedNumeric = normalizeTelegramChatNumeric(allowedRawValue);
    return Boolean(chatNumeric && allowedNumeric && chatNumeric === allowedNumeric);
  });
}

function buildAdminDashboardUrl(orderId) {
  const base = String(env.APP_URL || "").replace(/\/$/, "");
  const path = "/admin/dashboard?tab=orders&orderId=" + encodeURIComponent(String(orderId || ""));
  return base ? `${base}${path}` : path;
}

function buildTelegramOrderKeyboard(orderId, status) {
  const current = String(status || "new").trim().toLowerCase();
  const rows = [];

  if (current === "new") {
    rows.push([
      { text: "Contacted", callback_data: "ord:contacted:" + orderId },
      { text: "Paid", callback_data: "ord:paid:" + orderId },
    ]);
    rows.push([{ text: "Activate", callback_data: "ord:approved:" + orderId }]);
  } else if (current === "contacted") {
    rows.push([{ text: "Paid", callback_data: "ord:paid:" + orderId }]);
    rows.push([{ text: "Activate", callback_data: "ord:approved:" + orderId }]);
  } else if (current === "paid") {
    rows.push([{ text: "Activate", callback_data: "ord:approved:" + orderId }]);
  }

  rows.push([{ text: "Open admin", url: buildAdminDashboardUrl(orderId) }]);
  return rows;
}

async function updateTelegramOrderMessageKeyboard({ chatId, messageId, orderId, status }) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId || !messageId || !orderId) {
    return null;
  }

  const endpoint = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/editMessageReplyMarkup`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: String(chatId),
      message_id: Number(messageId),
      reply_markup: {
        inline_keyboard: buildTelegramOrderKeyboard(orderId, status),
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Telegram editMessageReplyMarkup failed with ${response.status}`);
  }

  return response.json().catch(() => null);
}

async function applyOrderActionFromTelegram({ orderId, nextStatus, operatorId }) {
  const notePrefixByStatus = {
    contacted: "Контакт отмечен через Telegram",
    paid: "Оплата отмечена через Telegram",
    approved: "Активация подтверждена через Telegram",
  };

  const currentOrder = await prisma.slugRequest.findUnique({
    where: { id: orderId },
    select: { status: true },
  });
  if (!currentOrder) {
    return { ok: false, code: "ORDER_NOT_FOUND", message: "Заявка не найдена", status: null };
  }
  if (!canApplyTelegramStatus(currentOrder.status, nextStatus)) {
    return {
      ok: false,
      code: "INVALID_STATUS_TRANSITION",
      message: `Нельзя сменить статус ${currentOrder.status} -> ${nextStatus}`,
      status: String(currentOrder.status || "").toLowerCase(),
    };
  }

  try {
    const notePrefix = notePrefixByStatus[nextStatus] || "Обновлено через Telegram";
    await applyOrderStatusTransition({
      orderId,
      status: nextStatus,
      adminNote: `${notePrefix} (operator:${operatorId})`,
      adminActor: `tg:${operatorId}`,
      source: "telegram_callback",
    });
    return { ok: true, message: `Статус обновлен: ${nextStatus}`, status: nextStatus };
  } catch (error) {
    if (error?.code === "ORDER_NOT_FOUND") {
      return { ok: false, code: error.code, message: "Заявка не найдена", status: null };
    }
    if (error?.code === "INVALID_STATUS_TRANSITION") {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        status: String(currentOrder.status || "").toLowerCase(),
      };
    }
    throw error;
  }
}

async function handleTelegramWebhook(req, res) {
  const update = req.body && typeof req.body === "object" ? req.body : {};
  const updateId = Number(update.update_id || 0);
  console.info("[telegram-webhook] update received", {
    updateId: Number.isFinite(updateId) && updateId > 0 ? updateId : null,
    keys: Object.keys(update).slice(0, 10),
    hasCallbackQuery: Boolean(update.callback_query),
  });
  const callback = update.callback_query;
  if (callback && typeof callback === "object") {
    console.info("[telegram-webhook] callback received", {
      callbackId: String(callback.id || "").trim(),
      chatId: String(callback?.message?.chat?.id || "").trim(),
      fromId: String(callback?.from?.id || "").trim(),
      data: String(callback.data || "").slice(0, 120),
    });
  }

  if (!isWebhookSecretValid(req)) {
    console.warn("[telegram-webhook] rejected: invalid secret", {
      hasHeaderSecret: Boolean(req.get("x-telegram-bot-api-secret-token")),
      hasQuerySecret: Boolean(req.query?.secret),
      hasPathSecret: Boolean(req.params?.secret),
    });
    const callbackQueryId = String(callback?.id || "").trim();
    if (callbackQueryId) {
      await sendTelegramCallbackAnswer({
        callbackQueryId,
        text: "Webhook отклонён: неверный секрет",
        showAlert: true,
      }).catch(() => null);
    }
    res.status(401).json({ ok: false, error: "Unauthorized webhook" });
    return;
  }

  if (!callback || typeof callback !== "object") {
    res.json({ ok: true });
    return;
  }

  const callbackQueryId = String(callback.id || "").trim();
  const chat = callback?.message?.chat && typeof callback.message.chat === "object" ? callback.message.chat : null;
  const chatId = String(chat?.id || "").trim();
  const operatorId = String(callback?.from?.id || "").trim() || "unknown";
  const messageId = Number(callback?.message?.message_id || 0);
  const parsed = parseOrderAction(callback.data);

  cleanupProcessedCallbacks();
  if (callbackQueryId && processedCallbacks.has(callbackQueryId)) {
    console.info("[telegram-webhook] duplicate callback ignored", { callbackQueryId });
    await sendTelegramCallbackAnswer({ callbackQueryId, text: "Уже обработано" }).catch(() => null);
    res.json({ ok: true });
    return;
  }

  if (!parsed?.action || !parsed.orderId) {
    console.warn("[telegram-webhook] callback parse failed", {
      callbackData: String(callback.data || "").slice(0, 120),
    });
    if (callbackQueryId) {
      await sendTelegramCallbackAnswer({ callbackQueryId, text: "Неизвестное действие" });
    }
    res.json({ ok: true });
    return;
  }

  const allowed = await isAllowedAdminChat(chat);
  if (!allowed) {
    console.warn("[telegram-webhook] rejected: unauthorized chat", { chatId });
    if (callbackQueryId) {
      await sendTelegramCallbackAnswer({ callbackQueryId, text: "Чат не авторизован", showAlert: true });
    }
    res.json({ ok: true });
    return;
  }

  const result = await applyOrderActionFromTelegram({
    orderId: parsed.orderId,
    nextStatus: parsed.action,
    operatorId,
  });
  console.info("[telegram-webhook] status transition result", {
    orderId: parsed.orderId,
    nextStatus: parsed.action,
    ok: result.ok,
    code: result.code || null,
  });

  if (callbackQueryId) {
    processedCallbacks.set(callbackQueryId, Date.now());
  }

  if (result.ok && messageId > 0 && chatId) {
    try {
      await updateTelegramOrderMessageKeyboard({
        chatId,
        messageId,
        orderId: parsed.orderId,
        status: result.status || parsed.action,
      });
    } catch (error) {
      console.error("[express-app] failed to update telegram order keyboard", error);
    }
  }

  if (callbackQueryId) {
    try {
      await sendTelegramCallbackAnswer({
        callbackQueryId,
        text: result.message,
        showAlert: !result.ok,
      });
    } catch (error) {
      console.error("[express-app] failed to answer telegram callback", error);
    }
  }

  res.json({ ok: true });
}

router.post("/webhook", asyncHandler(handleTelegramWebhook));
router.post("/webhook/:secret", asyncHandler(handleTelegramWebhook));

module.exports = {
  telegramApiRouter: router,
};


