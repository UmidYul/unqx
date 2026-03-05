const express = require("express");

const { prisma } = require("../../db/prisma");
const { asyncHandler } = require("../../middleware/async");

const router = express.Router();

router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const message = req.body?.message;
    const chatId = message?.chat?.id ? String(message.chat.id) : "";
    const username = typeof message?.from?.username === "string" ? message.from.username.replace(/^@+/, "") : null;
    const text = typeof message?.text === "string" ? message.text.trim() : "";

    if (!chatId || !text.startsWith("/start")) {
      res.json({ ok: true });
      return;
    }

    const payload = text.replace("/start", "").trim();
    const token = payload.startsWith("link_") ? payload.slice("link_".length) : "";
    if (!token) {
      res.json({ ok: true });
      return;
    }

    const rows = await prisma.$queryRawUnsafe(
      `
      SELECT id, user_id AS "userId", expires_at AS "expiresAt", used_at AS "usedAt"
      FROM telegram_link_tokens
      WHERE token = $1
      LIMIT 1
      `,
      token,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || row.usedAt || new Date(row.expiresAt).getTime() < Date.now()) {
      res.json({ ok: true });
      return;
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: row.userId },
        data: {
          telegramChatId: chatId,
          ...(username ? { telegramUsername: username } : {}),
        },
      }),
      prisma.$executeRawUnsafe(`UPDATE telegram_link_tokens SET used_at = now() WHERE id = $1`, row.id),
    ]);

    res.json({ ok: true });
  }),
);

module.exports = {
  telegramApiRouter: router,
};

