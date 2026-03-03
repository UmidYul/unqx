const { prisma } = require("../db/prisma");

async function logServerError(req, error) {
  try {
    await prisma.errorLog.create({
      data: {
        type: "server_error",
        path: req.originalUrl || req.url || "unknown",
        message: error instanceof Error ? error.message : String(error),
        userAgent: req.get("user-agent") || "",
      },
    });
  } catch (loggingError) {
    console.error("[express-app] failed to persist server error", loggingError);
  }
}

async function errorHandler(error, req, res, next) {
  console.error("[express-app] unhandled error", error);
  await logServerError(req, error);

  if (res.headersSent) {
    return next(error);
  }

  if (req.originalUrl.startsWith("/api/")) {
    return res.status(500).json({ error: "Internal Server Error" });
  }

  return res.status(500).render("public/error-500", {
    title: "Ошибка сервера",
  });
}

module.exports = {
  errorHandler,
};