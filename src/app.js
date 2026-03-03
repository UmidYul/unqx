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
const { adminApiRouter } = require("./routes/api/admin");
const { publicApiRouter } = require("./routes/api/cards");
const { adminPagesRouter } = require("./routes/pages/admin");
const { publicPagesRouter } = require("./routes/pages/public");
const { systemRouter } = require("./routes/system");
const { getBaseUrl } = require("./utils/url");
const { ensureCsrfToken } = require("./middleware/csrf");
const { runBootstrapTasks } = require("./services/bootstrap");

function createApp() {
  const app = express();
  const pgPool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const expressPublicDir = path.join(env.EXPRESS_APP_DIR, "public");
  const rootPublicDir = env.PUBLIC_DIR;
  const disableHttpsEnforcement = env.DISABLE_HTTPS_ENFORCEMENT === true;

  app.set("trust proxy", env.TRUST_PROXY);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(compression());
  app.use((req, res, next) => {
    res.locals.cspNonce = randomBytes(16).toString("base64");
    next();
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
          scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'"],
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
      maxAge: "7d",
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
      maxAge: "7d",
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
      name: "unqx.sid",
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.SESSION_COOKIE_SECURE,
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

  app.use((req, res, next) => {
    const baseUrl = getBaseUrl();
    const path = req.path && req.path.startsWith("/") ? req.path : "/";
    const canonicalPath = path === "/" ? "/" : path.replace(/\/+$/, "");
    const canonicalUrl = `${baseUrl}${canonicalPath}`;
    const csrfToken = ensureCsrfToken(req);

    res.locals.adminSession = getAdminSession(req);
    res.locals.currentPath = req.path;
    res.locals.baseUrl = baseUrl;
    res.locals.canonicalUrl = canonicalUrl;
    res.locals.noindex = req.path.startsWith("/admin");
    res.locals.csrfToken = csrfToken;

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

    if (req.path.startsWith("/admin")) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    }

    next();
  });

  app.use("/api/admin", adminApiRouter);
  app.use("/api/cards", publicApiRouter);

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

  return app;
}

module.exports = {
  createApp,
};
