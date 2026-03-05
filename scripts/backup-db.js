const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const dotenv = require("dotenv");

const APP_DIR = path.join(__dirname, "..");
const ROOT_DIR = path.resolve(APP_DIR, "..");

dotenv.config({ path: path.join(APP_DIR, ".env"), override: false, quiet: true });
dotenv.config({ path: path.join(ROOT_DIR, ".env"), override: false, quiet: true });

function asInt(value, fallback) {
  const parsed = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function asBool(value, fallback = false) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

function buildTimestamp(now = new Date()) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
}

function formatDurationMs(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function runCommand(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
      ...opts,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
        return;
      }
      const error = new Error(`${cmd} exited with code ${code}`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

function normalizeRemotePath(remote) {
  return String(remote || "").trim().replace(/\/+$/, "");
}

function joinRemotePath(remote, name) {
  return `${normalizeRemotePath(remote)}/${String(name || "").replace(/^\/+/, "")}`;
}

async function sendTelegramStatus({ ok, chatId, token, message, inlineButtonUrl = "", inlineButtonText = "Открыть событие" }) {
  if (!chatId || !token) return;
  try {
    const endpoint = `https://api.telegram.org/bot${token}/sendMessage`;
    const payload = {
      chat_id: chatId,
      text: message,
      parse_mode: "HTML",
      disable_web_page_preview: true,
    };
    if (inlineButtonUrl) {
      payload.reply_markup = {
        inline_keyboard: [[{ text: inlineButtonText, url: inlineButtonUrl }]],
      };
    }
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[backup] telegram notify failed (${response.status}): ${body}`);
    }
  } catch (error) {
    console.error(`[backup] telegram notify error: ${error.message}`);
  }
  if (!ok) {
    // Keep this function side-effect-only; main flow handles exit code.
  }
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const num = bytes / Math.pow(1024, idx);
  return `${num.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

async function pruneRemoteBackups({ rcloneBin, remote, prefix, keepFiles }) {
  const list = await runCommand(rcloneBin, ["lsf", remote, "--files-only"]);
  const files = list.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith(".dump"))
    .sort()
    .reverse();

  const stale = files.slice(keepFiles);
  for (const filename of stale) {
    const full = joinRemotePath(remote, filename);
    await runCommand(rcloneBin, ["deletefile", full]);
  }
  return { total: files.length, deleted: stale.length };
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(
      [
        "Usage: node scripts/backup-db.js",
        "",
        "Required env:",
        "  DATABASE_URL or DIRECT_URL",
        "  BACKUP_RCLONE_REMOTE (example: gdrive:unqx-backups)",
        "",
        "Optional env:",
        "  BACKUP_KEEP_FILES=14",
        "  BACKUP_FILE_PREFIX=unqx-db",
        "  BACKUP_PGDUMP_BIN=pg_dump",
        "  BACKUP_RCLONE_BIN=rclone",
        "  BACKUP_NOTIFY_TELEGRAM=true",
        "  BACKUP_TELEGRAM_CHAT_ID=-1001234567890",
        "  BACKUP_STATUS_URL=https://your-domain.com/admin/dashboard",
      ].join("\n"),
    );
    return;
  }

  const startedAt = Date.now();
  const databaseUrl = String(process.env.DATABASE_URL || process.env.DIRECT_URL || "").trim();
  const pgDumpBin = String(process.env.BACKUP_PGDUMP_BIN || "pg_dump").trim();
  const rcloneBin = String(process.env.BACKUP_RCLONE_BIN || "rclone").trim();
  const rcloneRemote = normalizeRemotePath(process.env.BACKUP_RCLONE_REMOTE || "");
  const keepFiles = asInt(process.env.BACKUP_KEEP_FILES, 14);
  const tmpDir = String(process.env.BACKUP_TMP_DIR || os.tmpdir()).trim() || os.tmpdir();
  const filePrefix = String(process.env.BACKUP_FILE_PREFIX || "unqx-db").trim() || "unqx-db";
  const notifyEnabled = asBool(process.env.BACKUP_NOTIFY_TELEGRAM, true);
  const tgToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const tgChatId = String(process.env.BACKUP_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").trim();
  const statusUrl = String(process.env.BACKUP_STATUS_URL || "").trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is required");
  }
  if (!rcloneRemote) {
    throw new Error("BACKUP_RCLONE_REMOTE is required (example: gdrive:unqx-backups)");
  }

  fs.mkdirSync(tmpDir, { recursive: true });
  const fileName = `${filePrefix}-${buildTimestamp()}.dump`;
  const localPath = path.join(tmpDir, fileName);
  const remotePath = joinRemotePath(rcloneRemote, fileName);

  let sizeBytes = 0;
  let pruned = { total: 0, deleted: 0 };
  try {
    console.log(`[backup] dump start -> ${localPath}`);
    await runCommand(pgDumpBin, [
      "--dbname",
      databaseUrl,
      "--format=custom",
      "--no-owner",
      "--no-privileges",
      "--file",
      localPath,
    ]);

    const stats = fs.statSync(localPath);
    sizeBytes = stats.size;
    console.log(`[backup] dump done (${formatBytes(sizeBytes)})`);

    console.log(`[backup] upload start -> ${remotePath}`);
    await runCommand(rcloneBin, ["copyto", localPath, remotePath]);
    console.log("[backup] upload done");

    pruned = await pruneRemoteBackups({
      rcloneBin,
      remote: rcloneRemote,
      prefix: filePrefix,
      keepFiles,
    });
    if (pruned.deleted > 0) {
      console.log(`[backup] pruned ${pruned.deleted} old backup(s)`);
    }

    const duration = formatDurationMs(Date.now() - startedAt);
    const successText = [
      "<b>Backup: SUCCESS</b>",
      `File: <code>${fileName}</code>`,
      `Size: <code>${formatBytes(sizeBytes)}</code>`,
      `Remote: <code>${rcloneRemote}</code>`,
      `Kept: <code>${Math.min(pruned.total, keepFiles)}</code> / Limit: <code>${keepFiles}</code>`,
      `Duration: <code>${duration}</code>`,
    ].join("\n");

    if (notifyEnabled) {
      await sendTelegramStatus({
        ok: true,
        chatId: tgChatId,
        token: tgToken,
        message: successText,
        inlineButtonUrl: statusUrl,
      });
    }

    console.log("[backup] success");
  } catch (error) {
    const duration = formatDurationMs(Date.now() - startedAt);
    const stderr = String(error?.stderr || error?.message || "unknown error")
      .slice(0, 900)
      .replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char]));
    const failText = [
      "<b>Backup: FAILED</b>",
      `Remote: <code>${rcloneRemote || "-"}</code>`,
      `Duration: <code>${duration}</code>`,
      "",
      `<code>${stderr}</code>`,
    ].join("\n");

    if (notifyEnabled) {
      await sendTelegramStatus({
        ok: false,
        chatId: tgChatId,
        token: tgToken,
        message: failText,
        inlineButtonUrl: statusUrl,
      });
    }

    throw error;
  } finally {
    try {
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    } catch (cleanupError) {
      console.error(`[backup] local cleanup failed: ${cleanupError.message}`);
    }
  }
}

main().catch((error) => {
  console.error("[backup] failed:", error.message);
  process.exitCode = 1;
});
