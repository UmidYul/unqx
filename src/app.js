const path = require("node:path");

const express = require("express");
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

function createApp() {
  const app = express();
  const pgPool = new pg.Pool({ connectionString: env.DATABASE_URL });
  const expressPublicDir = path.join(env.EXPRESS_APP_DIR, "public");
  const rootPublicDir = env.PUBLIC_DIR;

  app.set("trust proxy", env.TRUST_PROXY);
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

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
    res.locals.adminSession = getAdminSession(req);
    res.locals.currentPath = req.path;
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

  return app;
}

module.exports = {
  createApp,
};
