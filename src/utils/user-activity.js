const { prisma } = require("../db/prisma");
const { randomUUID } = require("node:crypto");

const ACTION_LABELS = {
  login:           "Вход",
  logout:          "Выход",
  profile_update:  "Обновление профиля",
  avatar_update:   "Смена аватара",
  avatar_delete:   "Удаление аватара",
  password_change: "Смена пароля",
  card_create:     "Создание визитки",
  card_update:     "Обновление визитки",
  card_delete:     "Удаление визитки",
  slug_request:    "Запрос slug",
  slug_purchase:   "Покупка slug",
  plan_upgrade:    "Смена тарифа",
  email_verify:    "Подтверждение email",
  link_add:        "Добавление ссылки",
  link_remove:     "Удаление ссылки",
  qr_download:     "Скачивание QR",
};

/**
 * Log a user action. Non-blocking — never throws.
 * @param {object} opts
 * @param {string|null} opts.userId
 * @param {string|null} opts.userLogin
 * @param {string}      opts.action   — one of ACTION_LABELS keys or free string ≤60 chars
 * @param {string|null} [opts.detail] — short context string ≤500 chars
 * @param {object|null} [opts.req]    — Express request object for IP / user-agent
 */
async function logUserActivity({ userId, userLogin, action, detail, req }) {
  try {
    const ip = req
      ? String(
          (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
          req.socket?.remoteAddress ||
          ""
        ).slice(0, 45) || null
      : null;
    const ua = req
      ? String(req.headers["user-agent"] || "").slice(0, 500) || null
      : null;

    await prisma.userActivityLog.create({
      data: {
        id:        randomUUID(),
        userId:    userId   ? String(userId).slice(0, 36)   : null,
        userLogin: userLogin ? String(userLogin).slice(0, 200) : null,
        action:    String(action || "unknown").slice(0, 60),
        detail:    detail   ? String(detail).slice(0, 500)  : null,
        ip,
        userAgent: ua,
      },
    });
  } catch {
    // intentionally silent — logging must never break the request
  }
}

module.exports = { logUserActivity, ACTION_LABELS };
