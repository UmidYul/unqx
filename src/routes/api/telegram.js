const express = require("express");

const { asyncHandler } = require("../../middleware/async");
const { prisma } = require("../../db/prisma");
const { getSetting } = require("../../services/platform-settings");
const { sendSlugAwaitingPaymentToUser, sendTelegramCallbackAnswer } = require("../../services/telegram");

const router = express.Router();

function normalizeTelegramAction(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (normalized === "contacted") return "contacted";
  if (normalized === "paid") return "paid";
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
  return false;
}

function parseOrderAction(value) {
  const match = String(value || "").match(/^ord:(contacted|paid):([a-f0-9-]{30,40})$/i);
  if (!match) return null;
  return {
    action: normalizeTelegramAction(match[1]),
    orderId: String(match[2]),
  };
}

async function isAllowedAdminChat(chatId) {
  const configured = String(await getSetting("contact_telegram_chat_id", "")).trim();
  if (!configured) return true;
  return String(chatId || "").trim() === configured;
}

async function applyOrderActionFromTelegram({ orderId, nextStatus, operatorId }) {
  const order = await prisma.slugRequest.findUnique({
    where: { id: orderId },
    include: {
      user: {
        select: { telegramChatId: true },
      },
    },
  });

  if (!order) {
    return { ok: false, code: "NOT_FOUND", message: "Заявка не найдена" };
  }

  if (!canApplyTelegramStatus(order.status, nextStatus)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Нельзя сменить статус ${order.status} → ${nextStatus}`,
    };
  }

  const notePrefix = nextStatus === "paid" ? "Оплата отмечена через Telegram" : "Контакт отмечен через Telegram";
  const auditNote = `${notePrefix} (operator:${operatorId})`;
  const mergedNote = order.adminNote ? `${order.adminNote}\n${auditNote}` : auditNote;

  await prisma.slugRequest.update({
    where: { id: order.id },
    data: {
      status: nextStatus,
      adminNote: mergedNote.slice(0, 1000),
    },
  });

  if (nextStatus === "paid" && order.user?.telegramChatId) {
    try {
      await sendSlugAwaitingPaymentToUser({
        telegramId: order.user.telegramChatId,
        slug: order.slug,
      });
    } catch (error) {
      console.error("[express-app] failed to send user payment notification from telegram action", error);
    }
  }

  return { ok: true, message: `Статус обновлен: ${nextStatus}` };
}

router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
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
      await sendTelegramCallbackAnswer({
        callbackQueryId,
        text: result.message,
        showAlert: !result.ok,
      });
    }

    res.json({ ok: true });
  }),
);

module.exports = {
  telegramApiRouter: router,
};
