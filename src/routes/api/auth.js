const express = require("express");

const { prisma } = require("../../db/prisma");
const { asyncHandler } = require("../../middleware/async");
const { requireCsrfToken, ensureCsrfToken } = require("../../middleware/csrf");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { getUserSession, loginUserSession } = require("../../middleware/auth");
const { verifyTelegramLoginPayload, TelegramAuthError } = require("../../services/telegram-auth");
const { getEffectivePlan, normalizeDisplayName } = require("../../services/profile");
const { ensureUserRefCode, linkReferralOnRegistration } = require("../../services/referrals");

const router = express.Router();

function getUserDelegate() {
  const delegate = prisma.user;
  return delegate && typeof delegate === "object" ? delegate : null;
}

function ensureUserModelReady(res) {
  if (!getUserDelegate()) {
    res.status(503).json({
      error: "Authentication is temporarily unavailable",
      code: "AUTH_STORAGE_UNAVAILABLE",
    });
    return false;
  }
  return true;
}

function isUserStorageMissing(error) {
  return Boolean(error) && error.code === "P2021" && String(error?.meta?.modelName || "") === "User";
}

function userToSessionPayload(user) {
  const displayName = normalizeDisplayName(user.displayName, user.firstName);
  return {
    telegramId: user.telegramId,
    firstName: user.firstName,
    lastName: user.lastName || null,
    username: user.username || null,
    photoUrl: user.photoUrl || null,
    displayName,
    plan: user.plan,
    planPurchasedAt: user.planPurchasedAt ? user.planPurchasedAt.toISOString() : null,
    planUpgradedAt: user.planUpgradedAt ? user.planUpgradedAt.toISOString() : null,
    status: user.status,
  };
}

function userToClientPayload(user) {
  const effective = getEffectivePlan(user);
  return {
    telegramId: user.telegramId,
    firstName: user.firstName,
    lastName: user.lastName || null,
    username: user.username || null,
    photoUrl: user.photoUrl || null,
    displayName: normalizeDisplayName(user.displayName, user.firstName),
    plan: user.plan,
    effectivePlan: effective.plan,
    planPurchasedAt: user.planPurchasedAt ? user.planPurchasedAt.toISOString() : null,
    planUpgradedAt: user.planUpgradedAt ? user.planUpgradedAt.toISOString() : null,
    status: user.status,
  };
}

router.post(
  "/telegram/callback",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    if (!ensureUserModelReady(res)) {
      return;
    }

    let parsed;
    try {
      parsed = verifyTelegramLoginPayload(req.body || {});
    } catch (error) {
      if (error instanceof TelegramAuthError) {
        res.status(401).json({ error: error.message, code: error.code });
        return;
      }
      throw error;
    }

    let user;
    const existedBefore = await prisma.user.findUnique({
      where: { telegramId: parsed.telegramId },
      select: { telegramId: true },
    });
    try {
      user = await prisma.user.upsert({
        where: { telegramId: parsed.telegramId },
        create: {
          telegramId: parsed.telegramId,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          username: parsed.username,
          photoUrl: parsed.photoUrl,
          displayName: parsed.firstName,
          status: "active",
        },
        update: {
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          username: parsed.username,
          photoUrl: parsed.photoUrl,
        },
      });
    } catch (error) {
      if (isUserStorageMissing(error)) {
        res.status(503).json({
          error: "Authentication is temporarily unavailable",
          code: "AUTH_STORAGE_UNAVAILABLE",
        });
        return;
      }
      throw error;
    }

    await ensureUserRefCode(user.telegramId);
    if (!existedBefore && req.session?.pendingRefCode) {
      await linkReferralOnRegistration({
        referredTelegramId: user.telegramId,
        refCode: req.session.pendingRefCode,
      });
    }

    await loginUserSession(req, userToSessionPayload(user));
    const csrfToken = ensureCsrfToken(req);

    res.json({
      ok: true,
      redirectTo: "/profile",
      csrfToken,
      user: userToClientPayload(user),
    });
  }),
);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (!ensureUserModelReady(res)) {
      return;
    }

    const sessionUser = getUserSession(req);
    if (!sessionUser || !sessionUser.telegramId) {
      res.json({ authenticated: false });
      return;
    }

    let user;
    try {
      user = await prisma.user.findUnique({
        where: { telegramId: sessionUser.telegramId },
      });
    } catch (error) {
      if (isUserStorageMissing(error)) {
        res.status(503).json({
          authenticated: false,
          error: "Authentication is temporarily unavailable",
          code: "AUTH_STORAGE_UNAVAILABLE",
        });
        return;
      }
      throw error;
    }

    if (!user) {
      res.json({ authenticated: false });
      return;
    }

    res.json({
      authenticated: true,
      user: userToClientPayload(user),
    });
  }),
);

router.post(
  "/logout",
  requireSameOrigin,
  asyncHandler(async (req, res) => {
    await new Promise((resolve, reject) => {
      if (!req.session) {
        resolve();
        return;
      }
      req.session.destroy((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    res.clearCookie("unqx.sid");
    const csrfToken = ensureCsrfToken(req);
    res.json({ ok: true, csrfToken });
  }),
);

module.exports = {
  authApiRouter: router,
  userToClientPayload,
};
