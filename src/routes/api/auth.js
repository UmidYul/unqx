const { randomBytes } = require("node:crypto");
const bcrypt = require("bcryptjs");
const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { requireCsrfToken, ensureCsrfToken } = require("../../middleware/csrf");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { getUserSession, loginUserSession } = require("../../middleware/auth");
const {
  authForgotPasswordRateLimit,
  authLoginRateLimit,
  authRegisterRateLimit,
  authSendOtpRateLimit,
} = require("../../middleware/rate-limit");
const { getEffectivePlan, normalizeDisplayName } = require("../../services/profile");
const {
  sendChangeEmailOtp,
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
  sendWelcomeEmail,
} = require("../../services/email");
const { linkReferralOnRegistration } = require("../../services/referrals");

const router = express.Router();
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const RESET_OTP_TTL_HOURS = 1;
const PASSWORD_ROUNDS = 12;
const LOGIN_LOCK_MINUTES = 15;
const MAX_OTP_ATTEMPTS = 5;

const USER_AUTH_SELECT = {
  id: true,
  telegramId: true,
  otpCode: true,
  otpExpiresAt: true,
  otpAttempts: true,
  resetPasswordToken: true,
  resetPasswordExpiresAt: true,
  email: true,
  emailVerified: true,
  firstName: true,
  lastName: true,
  username: true,
  photoUrl: true,
  displayName: true,
  plan: true,
  planPurchasedAt: true,
  planUpgradedAt: true,
  status: true,
  pendingEmail: true,
};

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function generateLegacyTelegramId() {
  return `legacy_${randomBytes(12).toString("hex")}`;
}

function generateOtp() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(OTP_LENGTH, "0");
}

function generateRefCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

async function generateUniqueRefCode() {
  for (let i = 0; i < 20; i += 1) {
    const candidate = generateRefCode();
    const existing = await prisma.user.findFirst({
      where: { refCode: candidate },
      select: { id: true },
    });
    if (!existing) {
      return candidate;
    }
  }
  return `${generateRefCode()}${generateRefCode().slice(0, 2)}`;
}

async function setVerificationOtp(userId) {
  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, PASSWORD_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: {
      otpCode: codeHash,
      otpExpiresAt: expiresAt,
      otpAttempts: 0,
    },
  });
  return { code, expiresAt };
}

async function setPasswordResetOtp(userId) {
  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, PASSWORD_ROUNDS);
  const expiresAt = new Date(Date.now() + RESET_OTP_TTL_HOURS * 60 * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: {
      resetPasswordToken: codeHash,
      resetPasswordExpiresAt: expiresAt,
    },
  });
  return { code, expiresAt };
}

async function destroyOtherSessions(req, userId) {
  if (!userId) return;
  const sid = req.sessionID || "";
  await prisma.$executeRawUnsafe(
    `
    DELETE FROM user_sessions
    WHERE sid <> $1
      AND (sess::jsonb #>> '{user,userId}') = $2
    `,
    sid,
    String(userId),
  );
}

function formatLockUntil(date) {
  const d = new Date(date);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function userToSessionPayload(user) {
  const displayName = normalizeDisplayName(user.displayName, user.firstName);
  return {
    userId: user.id,
    telegramId: user.telegramId || null,
    email: user.email || null,
    emailVerified: Boolean(user.emailVerified),
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
    id: user.id,
    telegramId: user.telegramId || null,
    email: user.email || null,
    emailVerified: Boolean(user.emailVerified),
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
  "/register",
  authRegisterRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const firstName = String(req.body?.firstName || "").trim().slice(0, 120);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!firstName || !email || !password || password.length < 8 || password !== confirmPassword) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR" });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({ error: "Этот email уже зарегистрирован. Войти →", code: "EMAIL_TAKEN" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
    const refCode = await generateUniqueRefCode();
    const user = await prisma.user.create({
      data: {
        telegramId: generateLegacyTelegramId(),
        firstName,
        email,
        passwordHash,
        emailVerified: false,
        plan: "none",
        status: "active",
        refCode,
      },
      select: USER_AUTH_SELECT,
    });

    const { code } = await setVerificationOtp(user.id);
    if (req.session?.pendingRefCode) {
      await linkReferralOnRegistration({
        referredTelegramId: user.telegramId,
        refCode: req.session.pendingRefCode,
      });
    }
    await sendEmailVerificationOtp({ email: user.email, firstName: user.firstName, code });

    res.json({
      ok: true,
      redirectTo: "/verify-email",
      email: user.email,
    });
  }),
);

router.post(
  "/send-otp",
  authSendOtpRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      res.status(400).json({ error: "Email is required", code: "VALIDATION_ERROR" });
      return;
    }
    const user = await prisma.user.findFirst({
      where: { email },
      select: USER_AUTH_SELECT,
    });
    if (!user) {
      res.json({ ok: true });
      return;
    }

    const { code } = await setVerificationOtp(user.id);
    await sendEmailVerificationOtp({ email: user.email, firstName: user.firstName, code });
    res.json({ ok: true });
  }),
);

router.post(
  "/verify-email",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").replace(/\D/g, "").slice(0, 6);

    const user = await prisma.user.findFirst({
      where: { email },
      select: USER_AUTH_SELECT,
    });

    if (!user || !user.otpCode || !user.otpExpiresAt) {
      res.status(400).json({ error: "Код недействителен. Запроси новый.", code: "OTP_INVALID" });
      return;
    }

    if (new Date(user.otpExpiresAt).getTime() < Date.now()) {
      res.status(400).json({ error: "Код устарел. Запроси новый.", code: "OTP_EXPIRED" });
      return;
    }

    const ok = await bcrypt.compare(code, user.otpCode);
    if (!ok) {
      const attempts = Number(user.otpAttempts || 0) + 1;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          otpAttempts: attempts,
          ...(attempts >= MAX_OTP_ATTEMPTS
            ? {
                otpCode: null,
                otpExpiresAt: null,
                otpAttempts: 0,
              }
            : {}),
        },
      });
      res.status(400).json({
        error: attempts >= MAX_OTP_ATTEMPTS ? "Код недействителен. Запроси новый." : "Неверный код",
        code: attempts >= MAX_OTP_ATTEMPTS ? "OTP_INVALIDATED" : "OTP_INVALID",
      });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      },
      select: USER_AUTH_SELECT,
    });

    await loginUserSession(req, userToSessionPayload(updated), { rememberMe: true });
    await sendWelcomeEmail({ email: updated.email, firstName: updated.firstName });

    res.json({ ok: true, redirectTo: "/profile", user: userToClientPayload(updated) });
  }),
);

router.post(
  "/login",
  authLoginRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const rememberMe = Boolean(req.body?.rememberMe);

    const genericError = { error: "Неверный email или пароль", code: "INVALID_CREDENTIALS" };
    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        ...USER_AUTH_SELECT,
        passwordHash: true,
        loginAttempts: true,
        lockedUntil: true,
      },
    });
    if (!user || !user.passwordHash) {
      res.status(401).json(genericError);
      return;
    }

    if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
      res.status(423).json({
        error: `Аккаунт заблокирован до ${formatLockUntil(user.lockedUntil)}`,
        code: "LOCKED",
      });
      return;
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      const attempts = Number(user.loginAttempts || 0) + 1;
      const locked = attempts >= 5 ? new Date(Date.now() + LOGIN_LOCK_MINUTES * 60 * 1000) : null;
      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: attempts >= 5 ? 0 : attempts,
          lockedUntil: locked,
        },
      });
      if (locked) {
        res.status(423).json({
          error: "Слишком много попыток. Попробуй через 15 минут.",
          code: "LOCKED",
        });
        return;
      }
      res.status(401).json(genericError);
      return;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    if (!user.emailVerified) {
      res.status(403).json({ error: "Сначала подтверди email.", code: "UNVERIFIED", email: user.email });
      return;
    }

    await loginUserSession(req, userToSessionPayload(user), { rememberMe });
    res.json({ ok: true, redirectTo: "/profile", user: userToClientPayload(user) });
  }),
);

router.post(
  "/forgot-password",
  authForgotPasswordRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const user = await prisma.user.findFirst({
      where: { email },
      select: USER_AUTH_SELECT,
    });
    if (user && user.email) {
      const { code } = await setPasswordResetOtp(user.id);
      await sendPasswordResetOtp({ email: user.email, firstName: user.firstName, code });
    }
    res.json({
      ok: true,
      message: "Если аккаунт с таким email существует, мы отправили код для сброса пароля.",
      redirectTo: `/reset-password?email=${encodeURIComponent(email)}`,
    });
  }),
);

router.post(
  "/reset-password",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").replace(/\D/g, "").slice(0, 6);
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!email || !code || newPassword.length < 8 || newPassword !== confirmPassword) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        resetPasswordToken: true,
        resetPasswordExpiresAt: true,
      },
    });
    if (!user || !user.resetPasswordToken || !user.resetPasswordExpiresAt) {
      res.status(400).json({ error: "Код недействителен или устарел.", code: "RESET_TOKEN_INVALID" });
      return;
    }

    if (new Date(user.resetPasswordExpiresAt).getTime() < Date.now()) {
      res.status(400).json({ error: "Код недействителен или устарел.", code: "RESET_TOKEN_EXPIRED" });
      return;
    }

    const valid = await bcrypt.compare(code, user.resetPasswordToken);
    if (!valid) {
      res.status(400).json({ error: "Код недействителен или устарел.", code: "RESET_TOKEN_INVALID" });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    await destroyOtherSessions(req, user.id);
    res.json({ ok: true, redirectTo: "/login" });
  }),
);

router.post(
  "/change-email/request",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const sessionUser = getUserSession(req);
    if (!sessionUser?.userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const newEmail = normalizeEmail(req.body?.email);
    const currentPassword = String(req.body?.currentPassword || "");
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.userId },
      select: {
        ...USER_AUTH_SELECT,
        passwordHash: true,
      },
    });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const passOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passOk) {
      res.status(401).json({ error: "Неверный email или пароль", code: "INVALID_CREDENTIALS" });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: { email: newEmail, id: { not: user.id } },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({ error: "Этот email уже зарегистрирован. Войти →", code: "EMAIL_TAKEN" });
      return;
    }

    const { code } = await setVerificationOtp(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { pendingEmail: newEmail },
    });

    await sendChangeEmailOtp({
      email: newEmail,
      firstName: user.firstName,
      code,
      newEmail,
    });

    res.json({ ok: true, pendingEmail: newEmail });
  }),
);

router.post(
  "/change-email/verify",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const sessionUser = getUserSession(req);
    if (!sessionUser?.userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const code = String(req.body?.code || "").replace(/\D/g, "").slice(0, 6);
    const user = await prisma.user.findUnique({
      where: { id: sessionUser.userId },
      select: USER_AUTH_SELECT,
    });
    if (!user || !user.pendingEmail || !user.otpCode || !user.otpExpiresAt) {
      res.status(400).json({ error: "Код недействителен. Запроси новый.", code: "OTP_INVALID" });
      return;
    }

    if (new Date(user.otpExpiresAt).getTime() < Date.now()) {
      res.status(400).json({ error: "Код устарел. Запроси новый.", code: "OTP_EXPIRED" });
      return;
    }

    const ok = await bcrypt.compare(code, user.otpCode);
    if (!ok) {
      res.status(400).json({ error: "Код недействителен. Запроси новый.", code: "OTP_INVALID" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        emailVerified: true,
        otpCode: null,
        otpExpiresAt: null,
        otpAttempts: 0,
      },
      select: USER_AUTH_SELECT,
    });

    await loginUserSession(req, userToSessionPayload(updated), { rememberMe: true });
    res.json({ ok: true, user: userToClientPayload(updated) });
  }),
);

router.post(
  "/change-password",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const sessionUser = getUserSession(req);
    if (!sessionUser?.userId) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const currentPassword = String(req.body?.currentPassword || "");
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");
    if (newPassword.length < 8 || newPassword !== confirmPassword) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });
    if (!user || !user.passwordHash) {
      res.status(401).json({ error: "Unauthorized", code: "AUTH_REQUIRED" });
      return;
    }

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Неверный email или пароль", code: "INVALID_CREDENTIALS" });
      return;
    }

    const nextPasswordHash = await bcrypt.hash(newPassword, PASSWORD_ROUNDS);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: nextPasswordHash },
    });
    await destroyOtherSessions(req, user.id);
    res.json({ ok: true });
  }),
);

router.get(
  "/me",
  asyncHandler(async (req, res) => {
    const sessionUser = getUserSession(req);
    if (!sessionUser?.userId) {
      res.json({ authenticated: false });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.userId },
      select: USER_AUTH_SELECT,
    });

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
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const sessionId = req.sessionID;
    if (req.session) {
      delete req.session.user;
    }

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

    if (sessionId && req.sessionStore && typeof req.sessionStore.destroy === "function") {
      await new Promise((resolve, reject) => {
        req.sessionStore.destroy(sessionId, (error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    res.clearCookie("unqx.sid", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: env.SESSION_COOKIE_SECURE === true,
    });
    const csrfToken = ensureCsrfToken(req);
    res.json({ ok: true, csrfToken });
  }),
);

module.exports = {
  authApiRouter: router,
  userToClientPayload,
};
