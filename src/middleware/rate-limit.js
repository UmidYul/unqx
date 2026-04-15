const { ipKeyGenerator, rateLimit } = require("express-rate-limit");

function emailKeyGenerator(req) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (email) {
    return `email:${email}`;
  }
  return `ip:${ipKeyGenerator(req)}`;
}

function authSubjectKeyGenerator(req) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (email) {
    return `email:${email}`;
  }

  const userId = typeof req.session?.user?.userId === "string" ? req.session.user.userId.trim() : "";
  if (userId) {
    return `user:${userId}`;
  }

  return `ip:${ipKeyGenerator(req)}`;
}

const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many login attempts. Try again later.",
});

const adminApiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

const publicOrderRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

const publicGameSpinRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMITED" },
});

const authLoginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  // Raised from 5 to 15: shared NAT/VPN addresses serve multiple users and hit
  // the old limit too quickly, causing spurious WAF-block errors on mobile.
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMITED" },
});

const authRegisterRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMITED" },
});

const authCheckAvailabilityRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMITED" },
});

const authSendOtpRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: emailKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMITED" },
});

const authForgotPasswordRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  keyGenerator: emailKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMITED" },
});

const authOtpVerifyRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: authSubjectKeyGenerator,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests", code: "RATE_LIMITED" },
});

module.exports = {
  loginRateLimit,
  adminApiRateLimit,
  publicOrderRateLimit,
  publicGameSpinRateLimit,
  authLoginRateLimit,
  authRegisterRateLimit,
  authCheckAvailabilityRateLimit,
  authSendOtpRateLimit,
  authForgotPasswordRateLimit,
  authOtpVerifyRateLimit,
};
