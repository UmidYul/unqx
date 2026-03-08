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
  const match = String(value || "").match(/^ord:(contacted|paid|approved):([a-z0-9-]{8,64})$/i);
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

async function isAllowedAdminChat(chatId) {
  const configured = String(await getSetting("contact_telegram_chat_id", "")).trim();
  const fallback = String(env.TELEGRAM_CHAT_ID || "").trim();
  const allowedRaw = configured || fallback;
  if (!allowedRaw) return true;

  const allowedChats = allowedRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!allowedChats.length) return true;

  return allowedChats.includes(String(chatId || "").trim());
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
    return { ok: false, code: "ORDER_NOT_FOUND", message: "Заявка не найдена" };
  }
  if (!canApplyTelegramStatus(currentOrder.status, nextStatus)) {
    return {
      ok: false,
      code: "INVALID_STATUS_TRANSITION",
      message: `Нельзя сменить статус ${currentOrder.status} -> ${nextStatus}`,
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
    return { ok: true, message: `Статус обновлен: ${nextStatus}` };
  } catch (error) {
    if (error?.code === "ORDER_NOT_FOUND") {
      return { ok: false, code: error.code, message: "Заявка не найдена" };
    }
    if (error?.code === "INVALID_STATUS_TRANSITION") {
      return { ok: false, code: error.code, message: error.message };
    }
    throw error;
  }
}

async function handleTelegramWebhook(req, res) {
  if (!isWebhookSecretValid(req)) {
    res.status(401).json({ ok: false, error: "Unauthorized webhook" });
    return;
  }

  const update = req.body && typeof req.body === "object" ? req.body : {};
  const callback = update.callback_query;

  if (!callback || typeof callback !== "object") {
    res.json({ ok: true });
    return;
  }

  const callbackQueryId = String(callback.id || "").trim();
  const chatId = String(callback?.message?.chat?.id || "").trim();
  const operatorId = String(callback?.from?.id || "").trim() || "unknown";
  const parsed = parseOrderAction(callback.data);

  cleanupProcessedCallbacks();
  if (callbackQueryId && processedCallbacks.has(callbackQueryId)) {
    await sendTelegramCallbackAnswer({ callbackQueryId, text: "Уже обработано" }).catch(() => null);
    res.json({ ok: true });
    return;
  }

  if (!parsed?.action || !parsed.orderId) {
    if (callbackQueryId) {
      await sendTelegramCallbackAnswer({ callbackQueryId, text: "Неизвестное действие" });
    }
    res.json({ ok: true });
    return;
  }

  const allowed = await isAllowedAdminChat(chatId);
  if (!allowed) {
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
  if (callbackQueryId) {
    processedCallbacks.set(callbackQueryId, Date.now());
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
