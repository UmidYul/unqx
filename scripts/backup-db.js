const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const dotenv = require("dotenv");
const { Storage } = require("@google-cloud/storage");

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

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const num = bytes / Math.pow(1024, idx);
  return `${num.toFixed(idx === 0 ? 0 : 2)} ${units[idx]}`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char]));
}

function normalizeObjectPrefix(prefix) {
  return String(prefix || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
}

function buildObjectName(prefix, fileName) {
  const cleanPrefix = normalizeObjectPrefix(prefix);
  return cleanPrefix ? `${cleanPrefix}/${fileName}` : fileName;
}

function parseJsonBase64(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function createStorageClient() {
  const projectId = String(process.env.BACKUP_GCS_PROJECT_ID || "").trim() || undefined;
  const keyFile = String(process.env.BACKUP_GCS_KEY_FILE || "").trim();
  const keyJson = parseJsonBase64(process.env.BACKUP_GCS_KEY_JSON_BASE64);

  if (keyJson) {
    return new Storage({ projectId: projectId || keyJson.project_id, credentials: keyJson });
  }
  if (keyFile) {
    return new Storage({ projectId, keyFilename: keyFile });
  }
  return new Storage({ projectId });
}

async function sendTelegramStatus({ chatId, token, message, inlineButtonUrl = "", inlineButtonText = "Открыть событие" }) {
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
}

async function sendTelegramDocument({ chatId, token, filePath, fileName, caption = "" }) {
  if (!chatId || !token) return false;
  try {
    const endpoint = `https://api.telegram.org/bot${token}/sendDocument`;
    const fileBuffer = fs.readFileSync(filePath);
    const form = new FormData();
    form.append("chat_id", chatId);
    if (caption) {
      form.append("caption", caption);
      form.append("parse_mode", "HTML");
    }
    form.append("document", new Blob([fileBuffer]), fileName);

    const response = await fetch(endpoint, {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[backup] telegram sendDocument failed (${response.status}): ${body}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[backup] telegram sendDocument error: ${error.message}`);
    return false;
  }
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
    // eslint-disable-next-line no-await-in-loop
    await runCommand(rcloneBin, ["deletefile", full]);
  }
  return { total: files.length, deleted: stale.length };
}

async function pruneGcsBackups({ bucket, objectPrefix, filePrefix, keepFiles }) {
  const listPrefix = normalizeObjectPrefix(objectPrefix);
  const [files] = await bucket.getFiles({
    prefix: listPrefix ? `${listPrefix}/` : undefined,
  });

  const candidates = files
    .filter((item) => {
      const name = String(item?.name || "");
      const base = path.posix.basename(name);
      return base.startsWith(`${filePrefix}-`) && base.endsWith(".dump");
    })
    .sort((left, right) => {
      const a = path.posix.basename(String(left?.name || ""));
      const b = path.posix.basename(String(right?.name || ""));
      return b.localeCompare(a);
    });

  const stale = candidates.slice(keepFiles);
  for (const item of stale) {
    // eslint-disable-next-line no-await-in-loop
    await item.delete({ ignoreNotFound: true });
  }

  return { total: candidates.length, deleted: stale.length };
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    console.log(
      [
        "Usage: node scripts/backup-db.js",
        "",
        "Required env:",
        "  DATABASE_URL or DIRECT_URL",
        "  and one storage target:",
        "    BACKUP_RCLONE_REMOTE=gdrive:unqx-backups",
        "    or BACKUP_GCS_BUCKET=unqx-backups",
        "",
        "Optional env:",
        "  BACKUP_RCLONE_BIN=rclone",
        "  BACKUP_GCS_PREFIX=db",
        "  BACKUP_GCS_PROJECT_ID=your-gcp-project",
        "  BACKUP_GCS_KEY_FILE=/abs/path/service-account.json",
        "  BACKUP_GCS_KEY_JSON_BASE64=eyJ0eXBlIjoi...",
        "  BACKUP_KEEP_FILES=14",
        "  BACKUP_FILE_PREFIX=unqx-db",
        "  BACKUP_PGDUMP_BIN=pg_dump",
        "  BACKUP_NOTIFY_TELEGRAM=true",
        "  BACKUP_TELEGRAM_CHAT_ID=-1001234567890",
        "  BACKUP_TELEGRAM_SEND_FILE=true",
        "  BACKUP_TELEGRAM_MAX_FILE_MB=45",
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
  const gcsBucket = String(process.env.BACKUP_GCS_BUCKET || "").trim();
  const gcsPrefix = normalizeObjectPrefix(process.env.BACKUP_GCS_PREFIX || "db");
  const useRclone = Boolean(rcloneRemote);
  const useGcs = !useRclone && Boolean(gcsBucket);
  const keepFiles = asInt(process.env.BACKUP_KEEP_FILES, 14);
  const tmpDir = String(process.env.BACKUP_TMP_DIR || os.tmpdir()).trim() || os.tmpdir();
  const filePrefix = String(process.env.BACKUP_FILE_PREFIX || "unqx-db").trim() || "unqx-db";
  const notifyEnabled = asBool(process.env.BACKUP_NOTIFY_TELEGRAM, true);
  const sendFileToTelegram = asBool(process.env.BACKUP_TELEGRAM_SEND_FILE, true);
  const tgFileLimitBytes = asInt(process.env.BACKUP_TELEGRAM_MAX_FILE_MB, 45) * 1024 * 1024;
  const tgToken = String(process.env.TELEGRAM_BOT_TOKEN || "").trim();
  const tgChatId = String(process.env.BACKUP_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || "").trim();
  const statusUrl = String(process.env.BACKUP_STATUS_URL || "").trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is required");
  }
  if (!useRclone && !useGcs) {
    throw new Error("Set BACKUP_RCLONE_REMOTE (Drive) or BACKUP_GCS_BUCKET (GCS)");
  }

  fs.mkdirSync(tmpDir, { recursive: true });
  const fileName = `${filePrefix}-${buildTimestamp()}.dump`;
  const localPath = path.join(tmpDir, fileName);

  let uploadedTo = "";
  let sizeBytes = 0;
  let pruned = { total: 0, deleted: 0 };
  let sentAsDocument = false;

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

    if (useRclone) {
      const remotePath = joinRemotePath(rcloneRemote, fileName);
      uploadedTo = remotePath;
      console.log(`[backup] upload start -> ${remotePath}`);
      await runCommand(rcloneBin, ["copyto", localPath, remotePath]);
      console.log("[backup] upload done");

      pruned = await pruneRemoteBackups({
        rcloneBin,
        remote: rcloneRemote,
        prefix: filePrefix,
        keepFiles,
      });
    } else {
      const storage = createStorageClient();
      const bucket = storage.bucket(gcsBucket);
      const objectName = buildObjectName(gcsPrefix, fileName);
      uploadedTo = `gs://${gcsBucket}/${objectName}`;
      console.log(`[backup] upload start -> ${uploadedTo}`);
      await bucket.upload(localPath, {
        destination: objectName,
        resumable: true,
        validation: "crc32c",
        metadata: { contentType: "application/octet-stream" },
      });
      console.log("[backup] upload done");

      pruned = await pruneGcsBackups({
        bucket,
        objectPrefix: gcsPrefix,
        filePrefix,
        keepFiles,
      });
    }

    if (pruned.deleted > 0) {
      console.log(`[backup] pruned ${pruned.deleted} old backup(s)`);
    }

    if (notifyEnabled && sendFileToTelegram && tgToken && tgChatId && sizeBytes <= tgFileLimitBytes) {
      sentAsDocument = await sendTelegramDocument({
        chatId: tgChatId,
        token: tgToken,
        filePath: localPath,
        fileName,
        caption: `<b>DB backup file</b>\n<code>${escapeHtml(fileName)}</code>`,
      });
    }

    const duration = formatDurationMs(Date.now() - startedAt);
    const successText = [
      "<b>Backup: SUCCESS</b>",
      `File: <code>${escapeHtml(fileName)}</code>`,
      `Size: <code>${formatBytes(sizeBytes)}</code>`,
      `Storage: <code>${useRclone ? "Google Drive (rclone)" : "Google Cloud Storage"}</code>`,
      `Path: <code>${escapeHtml(uploadedTo)}</code>`,
      `Kept: <code>${Math.min(pruned.total, keepFiles)}</code> / Limit: <code>${keepFiles}</code>`,
      `Duration: <code>${duration}</code>`,
      `Telegram file: <code>${sentAsDocument ? "sent" : sendFileToTelegram ? "not-sent" : "disabled"}</code>`,
    ].join("\n");

    if (notifyEnabled) {
      await sendTelegramStatus({
        chatId: tgChatId,
        token: tgToken,
        message: successText,
        inlineButtonUrl: statusUrl,
      });
    }

    console.log("[backup] success");
  } catch (error) {
    const duration = formatDurationMs(Date.now() - startedAt);
    const stderr = escapeHtml(String(error?.stderr || error?.message || "unknown error").slice(0, 900));
    const failText = [
      "<b>Backup: FAILED</b>",
      `Storage: <code>${useRclone ? "Google Drive (rclone)" : "Google Cloud Storage"}</code>`,
      `Path: <code>${escapeHtml(uploadedTo || (useRclone ? rcloneRemote : gcsBucket) || "-")}</code>`,
      `Duration: <code>${duration}</code>`,
      "",
      `<code>${stderr}</code>`,
    ].join("\n");

    if (notifyEnabled) {
      await sendTelegramStatus({
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
