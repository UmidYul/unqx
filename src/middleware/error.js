const { prisma } = require("../db/prisma");

let dbErrorLoggingDisabled = false;
let panicShutdownScheduled = false;

function isPrismaPanic(error) {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error.name === "PrismaClientRustPanicError" ||
        (typeof error.message === "string" &&
          (error.message.includes("PANIC:") || error.message.includes("timer has gone away")))),
  );
}

function schedulePanicShutdown() {
  if (panicShutdownScheduled) {
    return;
  }

  panicShutdownScheduled = true;
  console.error("[express-app] prisma panic detected; process will exit to allow clean restart");

  setTimeout(() => {
    process.exit(1);
  }, 300).unref();
}

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
    if (isPrismaPanic(loggingError)) {
      dbErrorLoggingDisabled = true;
      console.error("[express-app] prisma panic while persisting server error; DB error logging disabled until restart");
      try {
        await prisma.$disconnect();
      } catch {}
      schedulePanicShutdown();
      return;
    }

    console.error("[express-app] failed to persist server error", loggingError);
  }
}

async function errorHandler(error, req, res, next) {
  console.error("[express-app] unhandled error", error);

  if (isPrismaPanic(error)) {
    dbErrorLoggingDisabled = true;
    schedulePanicShutdown();
  }

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
