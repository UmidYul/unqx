const rateLimit = require("express-rate-limit");

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

module.exports = {
  loginRateLimit,
  adminApiRateLimit,
};

