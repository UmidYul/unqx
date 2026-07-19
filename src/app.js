const path = require("node:path");
const { randomBytes } = require("node:crypto");

const express = require("express");
const compression = require("compression");
const helmet = require("helmet");
const session = require("express-session");
const pg = require("pg");
const pgSession = require("connect-pg-simple")(session);

const { env } = require("./config/env");
const { errorHandler } = require("./middleware/error");
const { getAdminSession } = require("./middleware/auth");
const { getUserSession } = require("./middleware/auth");
const { adminApiRouter } = require("./routes/api/admin");
const { authApiRouter } = require("./routes/api/auth");
const { publicApiRouter } = require("./routes/api/cards");
const { profileApiRouter } = require("./routes/api/profile");
const { mobileApiRouter } = require("./routes/api/mobile");
const { adminPagesRouter } = require("./routes/pages/admin");
const { publicPagesRouter } = require("./routes/pages/public");
const { featuresApiRouter } = require("./routes/api/features");
const { adminFeaturesApiRouter } = require("./routes/api/admin-features");
const { telegramApiRouter } = require("./routes/api/telegram");
const { paymentsApiRouter } = require("./routes/api/payments");
const { systemRouter } = require("./routes/system");
const { getBaseUrl } = require("./utils/url");
const { ensureCsrfToken } = require("./middleware/csrf");
const { SESSION_COOKIE_NAME, LEGACY_SESSION_COOKIE_NAMES, buildCookieOptions } = require("./utils/cookies");
const { runBootstrapTasks } = require("./services/bootstrap");
const { startPendingExpiryJob } = require("./services/pending-expiry");
const { startLiveJobs } = require("./services/live-jobs");
const { getManySettings } = require("./services/platform-settings");
const { randomFreeSlugApiRouter } = require("./routes/api/random-free-slug-router");
const { prisma } = require("./db/prisma");

const USER_ACTIVITY_TOUCH_INTERVAL_MS = 60 * 1000;

function getFirstHeaderValue(value) {
  if (!value || typeof value !== "string") {
    return "";
  }
  return value.split(",")[0].trim();
}

async function touchUserActivity(req, userSession) {
  const userId = userSession?.userId ? String(userSession.userId).trim() : "";
  if (!userId || req.method === "OPTIONS") {
    return;
  }

  const now = Date.now();
  const lastTouch = Number(req.session?.lastSeenTouchedAt || 0);
  if (Number.isFinite(lastTouch) && now - lastTouch < USER_ACTIVITY_TOUCH_INTERVAL_MS) {
    return;
  }

  if (req.session) {
    req.session.lastSeenTouchedAt = now;
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date(now) },
    });
  } catch (error) {
    console.error("[express-app] failed to update user activity", error);
  }
}

function truncateForLog(value, max = 160) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "-";
  }
  return normalized.length > max ? `${normalized.slice(0, max)}…` : normalized;
}

function createAuthApiLogger(routeBase) {
  return (req, res, next) => {
    const startedAt = Date.now();
    const originalJson = typeof res.json === "function" ? res.json.bind(res) : null;
    if (originalJson) {
      res.json = (payload) => {
        try {
          if (payload && typeof payload === "object") {
            res.locals.authResponseCode = typeof payload.code === "string" ? payload.code : "";
            const message = typeof payload.error === "string"
              ? payload.error
              : (typeof payload.message === "string" ? payload.message : "");
            res.locals.authResponseMessage = message;
          }
        } catch {
          // noop
        }
        return originalJson(payload);
      };
    }

    const path = String(req.path || "/");
    const interestingPath =
      path === "/login" ||
      path === "/open" ||
      path === "/register" ||
      path === "/me" ||
      path === "/status" ||
      path === "/logout" ||
      path === "/close" ||
      path === "/verify-email" ||
      path === "/send-otp" ||
      path === "/forgot-password" ||
      path === "/reset-password";

    if (!interestingPath) {
      next();
      return;
    }

    res.on("finish", () => {
      try {
        const requestId = String(res.locals.requestId || req.requestId || "-");
        const durationMs = Date.now() - startedAt;
        const userSession = getUserSession(req);
        const userId = userSession?.userId ? String(userSession.userId) : "guest";
        const forwardedFor = getFirstHeaderValue(req.get("x-forwarded-for"));
        const clientIp = truncateForLog(forwardedFor || req.ip || req.socket?.remoteAddress || "-");
        const userAgent = truncateForLog(req.get("user-agent"));
        const origin = truncateForLog(req.get("origin"));
        const referer = truncateForLog(req.get("referer"));
        const mobileMarker = truncateForLog(req.get("x-unqx-mobile-client"));
        const authCandidate = truncateForLog(req.get("x-unqx-auth-candidate"));
        const responseCode = truncateForLog(res.locals.authResponseCode);
        const responseMessage = truncateForLog(res.locals.authResponseMessage, 220);
        const logLine =
          `[express-app][auth-api] request_id=${requestId} method=${req.method} ` +
          `path=${routeBase}${path} status=${res.statusCode} user_id=${userId} ` +
          `ip=${clientIp} mobile=${mobileMarker} candidate=${authCandidate} code=${responseCode} ` +
          `origin=${origin} referer=${referer} msg=${responseMessage} ` +
          `ua=${userAgent} duration_ms=${durationMs}`;

        if (res.statusCode >= 500) {
          console.error(logLine);
          return;
        }
        if (res.statusCode >= 400) {
          console.warn(logLine);
          return;
        }
        console.log(logLine);
      } catch {
        // noop
      }
    });

    next();
  };
}

function createApp() {
  const app = express();
  const pgPool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const expressPublicDir = path.join(env.EXPRESS_APP_DIR, "public");
  const rootPublicDir = env.PUBLIC_DIR;
  const disableHttpsEnforcement = env.DISABLE_HTTPS_ENFORCEMENT === true;
  const staticAssetVersion = String(env.ASSET_VERSION || Date.now());
  const staticAssetMaxAge = env.NODE_ENV === "development" ? 0 : "7d";

  app.set("trust proxy", env.TRUST_PROXY);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.set("etag", false);

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(compression());
  app.use((req, res, next) => {
    res.locals.cspNonce = randomBytes(16).toString("base64");
    res.locals.assetVersion = staticAssetVersion;
    next();
  });

  app.use(async (req, res, next) => {
    try {
      const path = req.path || "/";
      const acceptsHtml = req.accepts(["html", "json", "text"]) === "html";
      const isStaticAssetRequest =
        path.startsWith("/css/") ||
        path.startsWith("/js/") ||
        path.startsWith("/images/") ||
        path.startsWith("/vendor/") ||
        path.startsWith("/brand/") ||
        path.startsWith("/uploads/") ||
        path === "/favicon.ico";
      const isPublicPageRequest =
        req.method === "GET" &&
        acceptsHtml &&
        !isStaticAssetRequest &&
        !path.startsWith("/admin") &&
        !path.startsWith("/api/admin") &&
        !path.startsWith("/api/auth") &&
        !path.startsWith("/api/profile") &&
        !path.startsWith("/api/telegram") &&
        !path.startsWith("/api/cards") &&
        !path.startsWith("/api/features") &&
        !path.startsWith("/api/");
      if (!isPublicPageRequest) {
        next();
        return;
      }
      const settings = await getManySettings([
        "maintenance_mode",
        "maintenance_message",
        "maintenance_release_report_mode",
        "maintenance_release_report_title",
        "maintenance_release_report_message",
        "maintenance_release_open_at",
      ]);
      const releaseReportMode = Boolean(settings.maintenance_release_report_mode);
      if (releaseReportMode) {
        const openAtRaw = String(settings.maintenance_release_open_at || "").trim();
        const openAtDate = openAtRaw ? new Date(openAtRaw) : null;
        const hasOpenAt = Boolean(openAtDate) && Number.isFinite(openAtDate.getTime());
        if (hasOpenAt && Date.now() >= openAtDate.getTime()) {
          next();
          return;
        }
        res.status(503).render("public/pre-release-report", {
          title: String(settings.maintenance_release_report_title || "Отсчёт до релиза"),
          reportMessage: String(
            settings.maintenance_release_report_message ||
            "Мы готовим релиз и финализируем проверку. Скоро вернемся с обновлением.",
          ),
          opensAt: hasOpenAt ? openAtDate.toISOString() : "",
          adminSession: getAdminSession(req),
        });
        return;
      }
      const maintenanceMode = Boolean(settings.maintenance_mode);
      if (!maintenanceMode) {
        next();
        return;
      }
      res.status(503).render("public/maintenance", {
        title: "Техническое обслуживание",
        maintenanceMessage: String(settings.maintenance_message || "Мы на техническом обслуживании. Скоро вернёмся."),
        adminSession: getAdminSession(req),
      });
    } catch {
      next();
    }
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          frameAncestors: ["'self'"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'", "'unsafe-eval'", "https://telegram.org", "https://*.telegram.org", (req, res) => `'nonce-${res.locals.cspNonce}'`],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "blob:", "https://t.me", "https://*.telegram.org", "https://telegram.org", "https://telesco.pe", "https://*.telesco.pe"],
          connectSrc: ["'self'"],
          frameSrc: ["'self'", "https://oauth.telegram.org", "https://*.telegram.org", "https://telegram.org"],
          formAction: ["'self'"],
          ...(disableHttpsEnforcement ? { upgradeInsecureRequests: null } : {}),
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: false,
      originAgentCluster: false,
      ...(disableHttpsEnforcement ? { hsts: false } : {}),
    }),
  );

  app.use(
    express.static(expressPublicDir, {
      etag: true,
      maxAge: staticAssetMaxAge,
      fallthrough: true,
      index: false,
    }),
  );

  app.use(
    "/brand",
    express.static(path.join(rootPublicDir, "brand"), {
      etag: true,
      maxAge: "30d",
      fallthrough: true,
      index: false,
    }),
  );

  app.use(
    "/uploads",
    express.static(path.join(rootPublicDir, "uploads"), {
      etag: true,
      maxAge: 0,
      fallthrough: true,
      index: false,
    }),
  );

  app.use(
    express.static(rootPublicDir, {
      etag: true,
      maxAge: staticAssetMaxAge,
      fallthrough: true,
      index: false,
    }),
  );

  app.use(
    session({
      store: new pgSession({
        pool: pgPool,
        tableName: "user_sessions",
        createTableIfMissing: true,
      }),
      proxy: env.TRUST_PROXY !== false,
      name: SESSION_COOKIE_NAME,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: env.SESSION_ROLLING,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.SESSION_COOKIE_SECURE,
        domain: env.SESSION_COOKIE_DOMAIN || undefined,
        maxAge: 1000 * 60 * env.SESSION_MAX_AGE_MINUTES,
      },
    }),
  );

  app.use((req, res, next) => {
    const rawCookie = String(req.get("cookie") || "");
    if (!rawCookie) {
      next();
      return;
    }

    for (const legacyName of LEGACY_SESSION_COOKIE_NAMES) {
      const escaped = legacyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`(?:^|;\\s*)${escaped}=`).test(rawCookie)) {
        res.clearCookie(legacyName, buildCookieOptions(req, { httpOnly: true }));
        // Also clear host-only legacy cookies left from older deployments.
        res.clearCookie(legacyName, {
          path: "/",
          sameSite: "lax",
          secure: buildCookieOptions(req).secure,
          httpOnly: true,
        });
      }
    }

    next();
  });

  app.use((req, res, next) => {
    const incomingRequestId = String(req.get("x-request-id") || "").trim();
    const requestId = incomingRequestId || randomBytes(12).toString("hex");
    req.requestId = requestId;
    res.locals.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);
    next();
  });

  app.use((req, _res, next) => {
    const refCode = typeof req.query?.ref === "string" ? req.query.ref.trim().toUpperCase() : "";
    const normalizedRefCode = refCode.replace(/[^A-Z0-9_]/g, "").slice(0, 40);
    if (normalizedRefCode && req.session) {
      req.session.pendingRefCode = normalizedRefCode;
    }
    next();
  });

  app.use((req, res, next) => {
    const refCode = typeof req.query?.ref === "string" ? req.query.ref.trim().toUpperCase() : "";
    const normalizedRefCode = refCode.replace(/[^A-Z0-9_]/g, "").slice(0, 40);
    if (!normalizedRefCode || req.path !== "/" || req.method !== "GET") {
      next();
      return;
    }

    const params = new URLSearchParams();
    Object.entries(req.query || {}).forEach(([key, value]) => {
      if (key === "ref") {
        return;
      }
      if (Array.isArray(value)) {
        value
          .filter((item) => typeof item === "string")
          .forEach((item) => {
            params.append(key, item);
          });
        return;
      }
      if (typeof value === "string") {
        params.set(key, value);
      }
    });

    const nextPath = `/ref/${encodeURIComponent(normalizedRefCode)}${params.toString() ? `?${params.toString()}` : ""}`;
    res.redirect(nextPath);
  });

  app.use((req, res, next) => {
    const baseUrl = getBaseUrl();
    const path = req.path && req.path.startsWith("/") ? req.path : "/";
    const canonicalPath = path === "/" ? "/" : path.replace(/\/+$/, "");
    const canonicalUrl = `${baseUrl}${canonicalPath}`;
    const acceptsHtml = req.method === "GET" && req.accepts(["html", "json", "text"]) === "html";
    const isStaticAssetRequest =
      path.startsWith("/css/") ||
      path.startsWith("/js/") ||
      path.startsWith("/images/") ||
      path.startsWith("/vendor/") ||
      path.startsWith("/brand/") ||
      path.startsWith("/uploads/") ||
      path === "/favicon.ico";
    const isHtmlPageRequest = acceptsHtml && !isStaticAssetRequest && !path.startsWith("/api/");
    const csrfToken = ensureCsrfToken(req);

    res.locals.adminSession = getAdminSession(req);
    res.locals.userSession = getUserSession(req);
    res.locals.telegramBotUsername = env.TELEGRAM_BOT_USERNAME || "";
    res.locals.currentPath = req.path;
    res.locals.baseUrl = baseUrl;
    res.locals.canonicalUrl = canonicalUrl;
    res.locals.noindex = req.path.startsWith("/admin") || req.path.startsWith("/manager");
    res.locals.csrfToken = csrfToken;

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    if (req.path.startsWith("/admin") || req.path.startsWith("/manager")) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    }

    // Dynamic HTML responses can include personalized markup and session
    // cookies. Mark them private/no-store so shared proxies can never reuse
    // one visitor's page or Set-Cookie for another visitor.
    if (isHtmlPageRequest || req.path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
      res.vary("Authorization");
      res.vary("Cookie");
    }

    touchUserActivity(req, res.locals.userSession).finally(() => {
      next();
    });
  });

  app.use("/api", (req, res, next) => {
    const startedAt = Date.now();
    const path = String(req.path || "/");
    const shouldLogProfileRequest =
      path === "/me" ||
      path === "/auth/me" ||
      path === "/mobile-auth/me" ||
      path === "/account/me" ||
      path === "/entry/me" ||
      path === "/access/me" ||
      path.startsWith("/profile");
    if (!shouldLogProfileRequest) {
      next();
      return;
    }

    res.on("finish", () => {
      try {
        const userSession = getUserSession(req);
        const userId = userSession?.userId ? String(userSession.userId) : "guest";
        const requestId = String(res.locals.requestId || "-");
        const durationMs = Date.now() - startedAt;
        console.log(
          `[express-app][profile-api] request_id=${requestId} method=${req.method} path=/api${path} status=${res.statusCode} user_id=${userId} duration_ms=${durationMs}`,
        );
      } catch {
        // noop
      }
    });

    next();
  });

  app.use("/api/admin", adminApiRouter);
  app.use("/api/auth", createAuthApiLogger("/api/auth"), authApiRouter);
  app.use("/api/mobile-auth", createAuthApiLogger("/api/mobile-auth"), authApiRouter);
  app.use("/api/account", createAuthApiLogger("/api/account"), authApiRouter);
  app.use("/api/entry", createAuthApiLogger("/api/entry"), authApiRouter);
  app.use("/api/access", createAuthApiLogger("/api/access"), authApiRouter);
  app.use("/api/profile", profileApiRouter);
  app.use("/api/cards", publicApiRouter);
  app.use("/api/payments", paymentsApiRouter);
  app.use("/api", mobileApiRouter);
  app.use("/api", featuresApiRouter);
  app.use("/api/admin", adminFeaturesApiRouter);
  app.use("/api/telegram", telegramApiRouter);
  app.use("/api/random-free-slug", randomFreeSlugApiRouter);

  app.use(systemRouter);
  app.use(adminPagesRouter);
  app.use(publicPagesRouter);

  app.use((req, res) => {
    if (req.originalUrl.startsWith("/api/")) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.status(404).render("public/not-found", {
      title: "Страница не найдена",
      slug: req.path.replace(/^\//, "") || "unknown",
      adminSession: getAdminSession(req),
    });
  });

  app.use(errorHandler);

  void runBootstrapTasks();
  startPendingExpiryJob();
  startLiveJobs();

  return app;
}

module.exports = {
  createApp,
};
