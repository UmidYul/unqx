const nodemailer = require("nodemailer");

const { env } = require("../config/env");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function sendEmail({ to, subject, html }) {
  const missing = [];
  if (!env.EMAIL_FROM) missing.push("EMAIL_FROM");
  if (!env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!env.SMTP_PORT) missing.push("SMTP_PORT");
  if (!env.SMTP_USER) missing.push("SMTP_USER");
  if (!env.SMTP_PASS) missing.push("SMTP_PASS");
  if (missing.length > 0) {
    throw new Error(`Email service is not configured: missing ${missing.join(", ")}`);
  }

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT),
    secure: Boolean(env.SMTP_SECURE),
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}

function layout({ title, body }) {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f5; padding:24px; color:#171717;">
    <div style="max-width:560px; margin:0 auto; background:#fff; border:1px solid #e5e5e5; border-radius:14px; padding:28px;">
      <div style="font-size:24px; font-weight:800; letter-spacing:-0.02em;">UNQX</div>
      <h1 style="margin:18px 0 0; font-size:22px; line-height:1.2;">${title}</h1>
      <div style="margin-top:16px; font-size:15px; line-height:1.6;">${body}</div>
      <p style="margin-top:24px; font-size:12px; color:#6b7280;">UNQX · Ташкент, Узбекистан</p>
    </div>
  </div>`;
}

function codeBlock(code) {
  const digits = String(code || "")
    .split("")
    .map((x) => escapeHtml(x))
    .join("");
  return `<div style="margin:14px 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:28px; letter-spacing:2px; font-weight:700;">${digits}</div>`;
}

function formatDateTime(value) {
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "скоро";
    return date.toLocaleString("ru-RU");
  } catch {
    return "скоро";
  }
}

async function sendEmailVerificationOtp({ email, firstName, code }) {
  const body = `
    <p>Привет, ${escapeHtml(firstName || "друг")}!</p>
    <p>Твой код подтверждения:</p>
    ${codeBlock(code)}
    <p>Код действителен 10 минут.</p>
    <p>Не передавай этот код никому.</p>
    <p>Если ты не регистрировался на UNQX — просто проигнорируй это письмо.</p>
  `;
  await sendEmail({
    to: email,
    subject: `Код подтверждения UNQX: ${code}`,
    html: layout({ title: "Подтверждение email", body }),
  });
}

async function sendPasswordResetOtp({ email, firstName, code }) {
  const body = `
    <p>Привет, ${escapeHtml(firstName || "друг")}!</p>
    <p>Код для сброса пароля:</p>
    ${codeBlock(code)}
    <p>Код действителен 1 час.</p>
    <p>Если ты не запрашивал сброс — просто проигнорируй это письмо.</p>
  `;
  await sendEmail({
    to: email,
    subject: `Сброс пароля UNQX: ${code}`,
    html: layout({ title: "Сброс пароля", body }),
  });
}

async function sendWelcomeEmail({ email, firstName }) {
  const body = `
    <p>Привет, ${escapeHtml(firstName || "друг")}!</p>
    <p>Твой аккаунт активирован.</p>
    <p>Следующий шаг — займи свой slug.</p>
    <p><a href="https://unqx.uz" style="display:inline-block; padding:10px 14px; border-radius:10px; background:#111; color:#fff; text-decoration:none; font-weight:600;">Занять slug</a></p>
  `;
  await sendEmail({
    to: email,
    subject: "Добро пожаловать в UNQX!",
    html: layout({ title: "Добро пожаловать", body }),
  });
}

async function sendChangeEmailOtp({ email, firstName, code, newEmail }) {
  const body = `
    <p>Привет, ${escapeHtml(firstName || "друг")}!</p>
    <p>Твой код подтверждения:</p>
    ${codeBlock(code)}
    <p>Код действителен 10 минут.</p>
    <p>Текущий email будет заменён на ${escapeHtml(newEmail)} после подтверждения.</p>
  `;
  await sendEmail({
    to: email,
    subject: `Подтверди новый email UNQX: ${code}`,
    html: layout({ title: "Подтверждение нового email", body }),
  });
}

async function sendAccountDeactivatedEmail({ email, firstName, restoreUntil }) {
  const untilLabel = formatDateTime(restoreUntil);
  const body = `
    <p>Привет, ${escapeHtml(firstName || "друг")}!</p>
    <p>Твой аккаунт UNQX деактивирован по твоему запросу.</p>
    <p>Восстановить доступ можно до <strong>${escapeHtml(untilLabel)}</strong>.</p>
    <p>Если захочешь вернуться — просто войди на UNQX и запусти восстановление аккаунта.</p>
  `;
  await sendEmail({
    to: email,
    subject: "Аккаунт UNQX деактивирован",
    html: layout({ title: "Аккаунт деактивирован", body }),
  });
}

async function sendAccountReactivationOtp({ email, firstName, code, restoreUntil }) {
  const untilLabel = formatDateTime(restoreUntil);
  const body = `
    <p>Привет, ${escapeHtml(firstName || "друг")}!</p>
    <p>Код для восстановления аккаунта:</p>
    ${codeBlock(code)}
    <p>Код действителен ограниченное время.</p>
    <p>Аккаунт можно восстановить до <strong>${escapeHtml(untilLabel)}</strong>.</p>
  `;
  await sendEmail({
    to: email,
    subject: `Код восстановления UNQX: ${code}`,
    html: layout({ title: "Восстановление аккаунта", body }),
  });
}

async function sendAccountReactivationReminderEmail({ email, firstName, restoreUntil, hoursLeft }) {
  const untilLabel = formatDateTime(restoreUntil);
  const body = `
    <p>Привет, ${escapeHtml(firstName || "друг")}!</p>
    <p>Твой аккаунт UNQX всё ещё деактивирован.</p>
    <p>До окончательного удаления осталось примерно <strong>${escapeHtml(String(hoursLeft || ""))} ч</strong>.</p>
    <p>Восстановление доступно до <strong>${escapeHtml(untilLabel)}</strong>.</p>
  `;
  await sendEmail({
    to: email,
    subject: "Напоминание: восстанови аккаунт UNQX",
    html: layout({ title: "Аккаунт скоро будет удалён", body }),
  });
}

async function sendAccountReactivatedEmail({ email, firstName }) {
  const body = `
    <p>Привет, ${escapeHtml(firstName || "друг")}!</p>
    <p>Твой аккаунт UNQX успешно восстановлен и снова активен.</p>
    <p>Если это были не ты — срочно смени пароль.</p>
  `;
  await sendEmail({
    to: email,
    subject: "Аккаунт UNQX восстановлен",
    html: layout({ title: "Доступ восстановлен", body }),
  });
}

async function sendAccountDeletedEmail({ email, firstName }) {
  const body = `
    <p>Привет, ${escapeHtml(firstName || "друг")}!</p>
    <p>Срок хранения деактивированного аккаунта истёк, аккаунт UNQX окончательно удалён.</p>
    <p>Для использования сервиса потребуется новая регистрация.</p>
  `;
  await sendEmail({
    to: email,
    subject: "Аккаунт UNQX удалён",
    html: layout({ title: "Аккаунт удалён", body }),
  });
}

module.exports = {
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
  sendWelcomeEmail,
  sendChangeEmailOtp,
  sendAccountDeactivatedEmail,
  sendAccountReactivationOtp,
  sendAccountReactivationReminderEmail,
  sendAccountReactivatedEmail,
  sendAccountDeletedEmail,
};
