const { prisma } = require("../db/prisma");

let dbErrorLoggingDisabled = false;

async function logServerError(req, error) {
  if (dbErrorLoggingDisabled) {
    return;
  }

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
    const isPanic =
      loggingError &&
      typeof loggingError === "object" &&
      (loggingError.name === "PrismaClientRustPanicError" ||
        (typeof loggingError.message === "string" &&
          (loggingError.message.includes("PANIC:") || loggingError.message.includes("timer has gone away"))));

    if (isPanic) {
      dbErrorLoggingDisabled = true;
      console.error("[express-app] prisma panic while persisting server error; DB error logging disabled until restart");
      try {
        await prisma.$disconnect();
      } catch {}
      return;
    }

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
