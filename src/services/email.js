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
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw new Error("Email service is not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.EMAIL_FROM,
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new Error(`Failed to send email: ${response.status} ${payload}`);
  }
}

function layout({ title, body }) {
  return `
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#f5f5f5; padding:24px; color:#171717;">
    <div style="max-width:560px; margin:0 auto; background:#fff; border:1px solid #e5e5e5; border-radius:14px; padding:28px;">
      <div style="font-size:24px; font-weight:800; letter-spacing:-0.02em;">UNQ+</div>
      <h1 style="margin:18px 0 0; font-size:22px; line-height:1.2;">${title}</h1>
      <div style="margin-top:16px; font-size:15px; line-height:1.6;">${body}</div>
      <p style="margin-top:24px; font-size:12px; color:#6b7280;">UNQ+ · Ташкент, Узбекистан</p>
    </div>
  </div>`;
}

function codeBlock(code) {
  const digits = String(code || "")
    .split("")
    .map((x) => escapeHtml(x))
    .join(" ");
  return `<div style="margin:14px 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size:28px; letter-spacing:8px; font-weight:700;">${digits}</div>`;
}

async function sendEmailVerificationOtp({ email, firstName, code }) {
  const body = `
    <p>Привет, ${escapeHtml(firstName || "друг")}!</p>
    <p>Твой код подтверждения:</p>
    ${codeBlock(code)}
    <p>Код действителен 10 минут.</p>
    <p>Не передавай этот код никому.</p>
    <p>Если ты не регистрировался на UNQ+ — просто проигнорируй это письмо.</p>
  `;
  await sendEmail({
    to: email,
    subject: `Код подтверждения UNQ+: ${code}`,
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
    subject: `Сброс пароля UNQ+: ${code}`,
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
    subject: "Добро пожаловать в UNQ+!",
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
    subject: `Подтверди новый email UNQ+: ${code}`,
    html: layout({ title: "Подтверждение нового email", body }),
  });
}

module.exports = {
  sendEmailVerificationOtp,
  sendPasswordResetOtp,
  sendWelcomeEmail,
  sendChangeEmailOtp,
};

