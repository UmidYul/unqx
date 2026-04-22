const bcrypt = require("bcryptjs");
const express = require("express");

const { prisma } = require("../../db/prisma");
const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { requireCsrfToken, ensureCsrfToken } = require("../../middleware/csrf");
const { requireSameOrigin } = require("../../middleware/same-origin");
const { getUserSession, loginUserSession, logoutUserSession } = require("../../middleware/auth");
const {
  authForgotPasswordRateLimit,
  authCheckAvailabilityRateLimit,
  authLoginRateLimit,
  authOtpVerifyRateLimit,
  authRegisterRateLimit,
  authSendOtpRateLimit,
} = require("../../middleware/rate-limit");
const { getEffectivePlan, normalizeDisplayName, normalizeProfileType } = require("../../services/profile");
const {
  sendChangeEmailOtp,
  sendAccountReactivationOtp,
  sendAccountReactivatedEmail,
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
  sendWelcomeEmail,
} = require("../../services/email");
const { linkReferralOnRegistration } = require("../../services/referrals");
const { resolveUzbekistanCity } = require("../../constants/uzbekistan-cities");
const { normalizeLogin, isValidLogin } = require("../../utils/login");
const { createUserAccessToken } = require("../../services/user-access-token");
const { SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAMES, buildCookieOptions } = require("../../utils/cookies");

const router = express.Router();
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const RESET_OTP_TTL_HOURS = 1;
const PASSWORD_ROUNDS = 12;
const LOGIN_LOCK_MINUTES = 15;
const MAX_OTP_ATTEMPTS = 5;
const ACCOUNT_REACTIVATION_WINDOW_DAYS = Number(env.ACCOUNT_REACTIVATION_WINDOW_DAYS || 30);
const ACCOUNT_REACTIVATION_OTP_TTL_MINUTES = Number(env.ACCOUNT_REACTIVATION_OTP_TTL_MINUTES || 10);

const USER_AUTH_SELECT = {
  id: true,
  otpCode: true,
  otpExpiresAt: true,
  otpAttempts: true,
  resetPasswordToken: true,
  resetPasswordExpiresAt: true,
  email: true,
  login: true,
  emailVerified: true,
  firstName: true,
  lastName: true,
  city: true,
  username: true,
  displayName: true,
  plan: true,
  planPurchasedAt: true,
  planUpgradedAt: true,
  profileType: true,
  status: true,
  pendingEmail: true,
  deactivatedAt: true,
  reactivationDeadlineAt: true,
  reactivationOtpCode: true,
  reactivationOtpExpiresAt: true,
  reactivationOtpSentAt: true,
  deletedAt: true,
};

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function normalizeCity(value) {
  return resolveUzbekistanCity(value);
}

function canResumePendingRegistration(existingUser, requestedEmail) {
  if (!existingUser || existingUser.emailVerified !== false || existingUser.status !== "active") {
    return false;
  }

  const existingEmail = normalizeEmail(existingUser.email);
  const nextEmail = normalizeEmail(requestedEmail);
  if (!existingEmail || !nextEmail) {
    return false;
  }

  return existingEmail === nextEmail;
}

function buildAvailabilityField(provided) {
  return {
    provided: Boolean(provided),
    valid: true,
    available: true,
    checked: false,
    message: "",
  };
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

function resolveReactivationDeadline(user) {
  if (user?.reactivationDeadlineAt) {
    return new Date(user.reactivationDeadlineAt);
  }
  if (user?.deactivatedAt) {
    return new Date(new Date(user.deactivatedAt).getTime() + ACCOUNT_REACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  }
  return new Date(Date.now() + ACCOUNT_REACTIVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

async function setReactivationOtp(userId) {
  const code = generateOtp();
  const codeHash = await bcrypt.hash(code, PASSWORD_ROUNDS);
  const expiresAt = new Date(Date.now() + ACCOUNT_REACTIVATION_OTP_TTL_MINUTES * 60 * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: {
      reactivationOtpCode: codeHash,
      reactivationOtpExpiresAt: expiresAt,
      reactivationOtpSentAt: new Date(),
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

function parseBooleanFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const raw = String(value || "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function resolveLoginInput(body) {
  const source = body && typeof body === "object" ? body : {};
  const loginRaw = source.login ?? source.identifier ?? source.idn ?? source.l;
  const passwordRaw = source.password ?? source.secret ?? source.key ?? source.p;
  const rememberRaw = source.rememberMe ?? source.remember ?? source.r;

  return {
    login: normalizeLogin(loginRaw),
    password: String(passwordRaw || ""),
    rememberMe: parseBooleanFlag(rememberRaw),
  };
}

function userToSessionPayload(user) {
  const displayName = normalizeDisplayName(user.displayName, user.firstName);
  return {
    userId: user.id,
    email: user.email || null,
    login: user.login || null,
    emailVerified: Boolean(user.emailVerified),
    firstName: user.firstName,
    lastName: user.lastName || null,
    city: user.city || null,
    username: user.username || null,
    displayName,
    plan: user.plan,
    planPurchasedAt: user.planPurchasedAt ? user.planPurchasedAt.toISOString() : null,
    planUpgradedAt: user.planUpgradedAt ? user.planUpgradedAt.toISOString() : null,
    profileType: normalizeProfileType(user.profileType, { fallback: "person" }),
    status: user.status,
  };
}

function userToClientPayload(user) {
  const effective = getEffectivePlan(user);
  return {
    id: user.id,
    email: user.email || null,
    login: user.login || null,
    emailVerified: Boolean(user.emailVerified),
    firstName: user.firstName,
    lastName: user.lastName || null,
    city: user.city || null,
    username: user.username || null,
    displayName: normalizeDisplayName(user.displayName, user.firstName),
    plan: user.plan,
    effectivePlan: effective.plan,
    planPurchasedAt: user.planPurchasedAt ? user.planPurchasedAt.toISOString() : null,
    planUpgradedAt: user.planUpgradedAt ? user.planUpgradedAt.toISOString() : null,
    profileType: normalizeProfileType(user.profileType, { fallback: "person" }),
    status: user.status,
  };
}

function buildAuthSuccessPayload(user, options = {}) {
  const rememberMe = Boolean(options.rememberMe);
  const includeRedirect = options.includeRedirect !== false;
  const redirectTo = options.redirectTo || "/profile";
  const sessionPayload = userToSessionPayload(user);
  const tokenPayload = createUserAccessToken(sessionPayload, { rememberMe });

  return {
    ok: true,
    authenticated: true,
    ...(includeRedirect ? { redirectTo } : {}),
    ...(tokenPayload
      ? {
        accessToken: tokenPayload.token,
        accessTokenExpiresAt: new Date(tokenPayload.expiresAt).toISOString(),
      }
      : {}),
    user: userToClientPayload(user),
  };
}

async function handleLoginRequest(req, res) {
  const { login, password, rememberMe } = resolveLoginInput(req.body);

  const genericError = { error: "Неверный логин или пароль", code: "INVALID_CREDENTIALS" };
  if (!login || !isValidLogin(login)) {
    res.status(401).json(genericError);
    return;
  }
  const userSelect = {
    ...USER_AUTH_SELECT,
    passwordHash: true,
    loginAttempts: true,
    lockedUntil: true,
  };

  let user = await prisma.user.findFirst({
    where: { login },
    select: userSelect,
  });

  // Backward-compatible fallback: allow login by email for legacy users.
  if (!user && login.includes("@")) {
    user = await prisma.user.findFirst({
      where: { email: login },
      select: userSelect,
    });
  }
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

  if (user.status === "blocked") {
    res.status(403).json({
      error: "Аккаунт отключен. Обратитесь в поддержку.",
      code: "ACCOUNT_DISABLED",
    });
    return;
  }

  if (user.status === "deleted") {
    res.status(410).json({
      error: "Аккаунт удалён. Нужна новая регистрация.",
      code: "ACCOUNT_DELETED",
    });
    return;
  }

  if (user.status === "deactivated") {
    const restoreUntil = resolveReactivationDeadline(user);
    if (restoreUntil.getTime() <= Date.now()) {
      res.status(410).json({
        error: "Срок восстановления истёк. Нужна новая регистрация.",
        code: "ACCOUNT_DELETED",
      });
      return;
    }
    res.status(403).json({
      error: "Аккаунт деактивирован. Восстанови его по коду из email.",
      code: "ACCOUNT_DEACTIVATED",
      email: user.email,
      restoreUntil: restoreUntil.toISOString(),
    });
    return;
  }

  if (user.email && !user.emailVerified) {
    res.status(403).json({ error: "Сначала подтверди email.", code: "UNVERIFIED", email: user.email });
    return;
  }

  await loginUserSession(req, userToSessionPayload(user), { rememberMe });
  await setOwnerSlugsCookie(req, res, user.id);
  res.json(buildAuthSuccessPayload(user, { rememberMe, redirectTo: "/profile" }));
}

async function handleAuthStatusRequest(req, res) {
  const csrfToken = ensureCsrfToken(req);
  const sessionUser = getUserSession(req);
  if (!sessionUser?.userId) {
    res.json({ authenticated: false, csrfToken });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.userId },
    select: USER_AUTH_SELECT,
  });

  if (!user) {
    res.json({ authenticated: false, csrfToken });
    return;
  }

  if (user.status !== "active") {
    await logoutUserSession(req);
    res.json({ authenticated: false, csrfToken, accountStatus: user.status });
    return;
  }

  const profileCardRows = await prisma.$queryRaw`
      SELECT avatar_url
      FROM profile_cards
      WHERE owner_id = ${user.id}
      LIMIT 1
    `;
  const avatarUrl = Array.isArray(profileCardRows) && profileCardRows[0]?.avatar_url
    ? String(profileCardRows[0].avatar_url).trim()
    : "";

  const userPayload = userToClientPayload(user);
  userPayload.photoUrl = avatarUrl || sessionUser.avatarUrl || "/brand/profile-user.svg";

  res.json({
    authenticated: true,
    user: userPayload,
    csrfToken,
  });
}

async function handleLogoutRequest(req, res) {
  const sessionId = req.sessionID;
  const hadSession = Boolean(req.session);

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

  if (!hadSession && sessionId && req.sessionStore && typeof req.sessionStore.destroy === "function") {
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

  if (req.sessionStore && typeof req.sessionStore.generate === "function") {
    req.sessionStore.generate(req);
  } else {
    await new Promise((resolve, reject) => {
      if (!req.session || typeof req.session.regenerate !== "function") {
        resolve();
        return;
      }
      req.session.regenerate((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  res.clearCookie(SESSION_COOKIE_NAME, buildCookieOptions(req, { httpOnly: true }));
  for (const legacyName of LEGACY_SESSION_COOKIE_NAMES) {
    res.clearCookie(legacyName, buildCookieOptions(req, { httpOnly: true }));
    res.clearCookie(legacyName, {
      path: "/",
      sameSite: "lax",
      secure: buildCookieOptions(req).secure,
      httpOnly: true,
    });
  }
  res.clearCookie("unqx_owner_slugs", buildCookieOptions(req));
  const csrfToken = ensureCsrfToken(req);
  res.json({ ok: true, csrfToken });
}

async function setOwnerSlugsCookie(req, res, userId) {
  if (!res || typeof res.cookie !== "function" || !userId) return;
  const slugs = await prisma.slug.findMany({
    where: {
      ownerId: userId,
      status: { in: ["active", "private", "paused", "approved"] },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { fullSlug: true },
  });
  const serialized = slugs
    .map((item) => String(item.fullSlug || "").trim().toUpperCase())
    .filter(Boolean)
    .join(",");
  res.cookie(
    "unqx_owner_slugs",
    serialized,
    buildCookieOptions(req, {
      maxAge: 30 * 24 * 60 * 60 * 1000,
    }),
  );
}

router.get(
  "/check-availability",
  authCheckAvailabilityRateLimit,
  asyncHandler(async (req, res) => {
    const login = normalizeLogin(req.query?.login);
    const email = normalizeEmail(req.query?.email);

    const response = {
      login: buildAvailabilityField(login),
      email: buildAvailabilityField(email),
    };

    if (login) {
      if (!isValidLogin(login)) {
        response.login.valid = false;
        response.login.available = false;
        response.login.message = "Логин может содержать только латиницу, цифры и символы . _ -";
      } else {
        response.login.checked = true;
      }
    }

    if (email) {
      if (!isValidEmailAddress(email)) {
        response.email.valid = false;
        response.email.available = false;
        response.email.message = "Введите email в формате name@example.com";
      } else {
        response.email.checked = true;
      }
    }

    const [existingLogin, existingEmail] = await Promise.all([
      response.login.checked
        ? prisma.user.findFirst({
          where: { login },
          select: { id: true },
        })
        : Promise.resolve(null),
      response.email.checked
        ? prisma.user.findFirst({
          where: { email },
          select: { id: true },
        })
        : Promise.resolve(null),
    ]);

    if (response.login.checked && existingLogin) {
      response.login.available = false;
      response.login.message = "Этот логин уже занят";
    }

    if (response.email.checked && existingEmail) {
      response.email.available = false;
      response.email.message = "Этот email уже используется";
    }

    res.json(response);
  }),
);

router.post(
  "/register",
  authRegisterRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const firstName = String(req.body?.firstName || "").trim().slice(0, 120);
    const city = normalizeCity(req.body?.city);
    const email = normalizeEmail(req.body?.email);
    const login = normalizeLogin(req.body?.login);
    const password = String(req.body?.password || "");
    const confirmPassword = String(req.body?.confirmPassword || "");
    const profileType = normalizeProfileType(req.body?.profileType, { fallback: "person" });

    if (!firstName || !city || !login || !isValidLogin(login) || !password || password.length < 8 || password !== confirmPassword) {
      res.status(400).json({ error: "Validation failed", code: "VALIDATION_ERROR" });
      return;
    }

    const existing = await prisma.user.findFirst({
      where: { login },
      select: {
        id: true,
        email: true,
        emailVerified: true,
        firstName: true,
        status: true,
      },
    });
    if (existing) {
      if (canResumePendingRegistration(existing, email)) {
        const codePayload = await setVerificationOtp(existing.id);
        await sendEmailVerificationOtp({
          email: existing.email,
          firstName: existing.firstName,
          code: codePayload.code,
        });
        res.json({
          ok: true,
          redirectTo: "/verify-email",
          email: existing.email,
          resumedPendingRegistration: true,
        });
        return;
      }

      res.status(409).json({ error: "Р­С‚РѕС‚ Р»РѕРіРёРЅ СѓР¶Рµ Р·Р°РЅСЏС‚. Р’РѕР№С‚Рё в†’", code: "LOGIN_TAKEN" });
      return;
      const hasEmail = typeof existing.email === "string" && existing.email.length > 0;
      const emailMatches = hasEmail && email && normalizeEmail(existing.email) === email;
      if (existing.emailVerified || !hasEmail || !emailMatches) {
        res.status(409).json({ error: "Этот логин уже занят. Войти →", code: "LOGIN_TAKEN" });
        return;
      }
    }

    if (email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email },
        select: { id: true },
      });
      if (existingEmail) {
        res.status(409).json({ error: "Этот email уже зарегистрирован. Войти →", code: "EMAIL_TAKEN" });
        return;
      }
    }

    const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
    const refCode = await generateUniqueRefCode();
    const user = await prisma.user.create({
      data: {
        firstName,
        city,
        email: email || null,
        login,
        passwordHash,
        emailVerified: false,
        plan: "none",
        profileType,
        status: "active",
        refCode,
      },
      select: USER_AUTH_SELECT,
    });

    const codePayload = email ? await setVerificationOtp(user.id) : null;
    if (req.session?.pendingRefCode) {
      await linkReferralOnRegistration({
        referredUserId: user.id,
        refCode: req.session.pendingRefCode,
      });
    }
    if (email && codePayload) {
      await sendEmailVerificationOtp({ email: user.email, firstName: user.firstName, code: codePayload.code });
    }

    res.json({
      ok: true,
      redirectTo: email ? "/verify-email" : "/profile",
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
    if (!isValidEmailAddress(email)) {
      res.status(400).json({ error: "Email is invalid", code: "VALIDATION_ERROR" });
      return;
    }
    const user = await prisma.user.findFirst({
      where: { email },
      select: USER_AUTH_SELECT,
    });
    if (!user || user.emailVerified) {
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
  authOtpVerifyRateLimit,
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
        error: "РљРѕРґ РЅРµРґРµР№СЃС‚РІРёС‚РµР»РµРЅ. Р—Р°РїСЂРѕСЃРё РЅРѕРІС‹Р№.",
        code: attempts >= MAX_OTP_ATTEMPTS ? "OTP_INVALIDATED" : "OTP_INVALID",
      });
      return;
    }
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
        error: "РљРѕРґ РЅРµРґРµР№СЃС‚РІРёС‚РµР»РµРЅ. Р—Р°РїСЂРѕСЃРё РЅРѕРІС‹Р№.",
        code: attempts >= MAX_OTP_ATTEMPTS ? "OTP_INVALIDATED" : "OTP_INVALID",
      });
      return;
    }
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
    await setOwnerSlugsCookie(req, res, updated.id);
    await sendWelcomeEmail({ email: updated.email, firstName: updated.firstName });

    res.json(buildAuthSuccessPayload(updated, { rememberMe: true, redirectTo: "/profile" }));
  }),
);

router.post(
  "/login",
  authLoginRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(handleLoginRequest),
);

router.post(
  "/open",
  authLoginRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(handleLoginRequest),
);

router.post(
  "/reactivate/request",
  authSendOtpRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      res.status(400).json({ error: "Email обязателен", code: "VALIDATION_ERROR" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        status: true,
        deactivatedAt: true,
        reactivationDeadlineAt: true,
      },
    });

    if (!user || user.status !== "deactivated") {
      res.status(400).json({ error: "Аккаунт недоступен для восстановления", code: "ACCOUNT_NOT_REACTIVATABLE" });
      return;
    }

    const restoreUntil = resolveReactivationDeadline(user);
    if (restoreUntil.getTime() <= Date.now()) {
      res.status(410).json({ error: "Срок восстановления истёк", code: "ACCOUNT_DELETED" });
      return;
    }

    const { code } = await setReactivationOtp(user.id);
    await sendAccountReactivationOtp({
      email: user.email,
      firstName: user.firstName,
      code,
      restoreUntil,
    });

    res.json({ ok: true, email: user.email, restoreUntil: restoreUntil.toISOString() });
  }),
);

router.post(
  "/reactivate/confirm",
  authOtpVerifyRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").replace(/\D/g, "").slice(0, 6);
    if (!email || code.length !== OTP_LENGTH) {
      res.status(400).json({ error: "Проверь email и код", code: "VALIDATION_ERROR" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { email },
      select: USER_AUTH_SELECT,
    });

    if (!user || user.status !== "deactivated") {
      res.status(400).json({ error: "Аккаунт недоступен для восстановления", code: "ACCOUNT_NOT_REACTIVATABLE" });
      return;
    }

    const restoreUntil = resolveReactivationDeadline(user);
    if (restoreUntil.getTime() <= Date.now()) {
      res.status(410).json({ error: "Срок восстановления истёк", code: "ACCOUNT_DELETED" });
      return;
    }

    if (!user.reactivationOtpCode || !user.reactivationOtpExpiresAt || new Date(user.reactivationOtpExpiresAt).getTime() < Date.now()) {
      res.status(400).json({ error: "Код недействителен или устарел", code: "REACTIVATION_OTP_INVALID" });
      return;
    }

    const validCode = await bcrypt.compare(code, user.reactivationOtpCode);
    if (!validCode) {
      res.status(400).json({ error: "Неверный код", code: "REACTIVATION_OTP_INVALID" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        status: "active",
        deactivatedAt: null,
        reactivationDeadlineAt: null,
        reactivationOtpCode: null,
        reactivationOtpExpiresAt: null,
        reactivationOtpSentAt: null,
        deletionReminder7SentAt: null,
        deletionReminder1SentAt: null,
        deletedAt: null,
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
      select: USER_AUTH_SELECT,
    });

    await loginUserSession(req, userToSessionPayload(updated), { rememberMe: true });
    await setOwnerSlugsCookie(req, res, updated.id);
    void sendAccountReactivatedEmail({ email: updated.email, firstName: updated.firstName }).catch((error) => {
      console.error("[express-app] failed to send account reactivated email", error);
    });

    res.json(buildAuthSuccessPayload(updated, { rememberMe: true, redirectTo: "/profile" }));
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
  authOtpVerifyRateLimit,
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || "").replace(/\D/g, "").slice(0, 6);
    const newPassword = String(req.body?.newPassword || "");
    const confirmPassword = String(req.body?.confirmPassword || "");

    if (!email) {
      res.status(400).json({ error: "Email обязателен.", code: "VALIDATION_ERROR" });
      return;
    }

    if (code.length !== OTP_LENGTH) {
      res.status(400).json({ error: "Код должен содержать 6 цифр.", code: "VALIDATION_ERROR" });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({
        error: "Пароль должен содержать минимум 8 символов.",
        code: "VALIDATION_ERROR",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      res.status(400).json({ error: "Пароли не совпадают.", code: "VALIDATION_ERROR" });
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
  authSendOtpRateLimit,
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
    if (!newEmail || !isValidEmailAddress(newEmail)) {
      res.status(400).json({ error: "Email is invalid", code: "VALIDATION_ERROR" });
      return;
    }
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

    if (normalizeEmail(user.email) === newEmail) {
      res.status(400).json({ error: "Email already in use by this account", code: "EMAIL_UNCHANGED" });
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
  authOtpVerifyRateLimit,
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
        error: "РљРѕРґ РЅРµРґРµР№СЃС‚РІРёС‚РµР»РµРЅ. Р—Р°РїСЂРѕСЃРё РЅРѕРІС‹Р№.",
        code: attempts >= MAX_OTP_ATTEMPTS ? "OTP_INVALIDATED" : "OTP_INVALID",
      });
      return;
    }

    const emailTaken = await prisma.user.findFirst({
      where: { email: user.pendingEmail, id: { not: user.id } },
      select: { id: true },
    });
    if (emailTaken) {
      res.status(409).json({ error: "Р­С‚РѕС‚ email СѓР¶Рµ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ. Р’РѕР№С‚Рё в†’", code: "EMAIL_TAKEN" });
      return;
    }
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
    await setOwnerSlugsCookie(req, res, updated.id);
    res.json(buildAuthSuccessPayload(updated, { rememberMe: true, includeRedirect: false }));
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
  asyncHandler(handleAuthStatusRequest),
);

router.get(
  "/status",
  asyncHandler(handleAuthStatusRequest),
);

router.post(
  "/logout",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(handleLogoutRequest),
);

router.post(
  "/close",
  requireSameOrigin,
  requireCsrfToken,
  asyncHandler(handleLogoutRequest),
);

module.exports = {
  authApiRouter: router,
  userToClientPayload,
};
