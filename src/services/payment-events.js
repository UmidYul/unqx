const { prisma } = require("../db/prisma");

function isMissingPaymentEventsTable(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return code === "42P01" || code === "P2021" || message.includes("payment_events");
}

async function logPaymentEvent({
  orderId,
  userId,
  status,
  provider,
  reference,
  amount,
  actor,
  source,
  note,
}) {
  try {
    await prisma.$executeRaw`
      INSERT INTO payment_events (
        id,
        order_id,
        user_id,
        status,
        provider,
        reference,
        amount,
        actor,
        source,
        note,
        created_at
      )
      VALUES (
        app_uuid_v4(),
        ${String(orderId || "")},
        ${String(userId || "")},
        ${String(status || "")},
        ${String(provider || "manual_tg")},
        ${String(reference || "")},
        ${Math.max(0, Math.round(Number(amount) || 0))},
        ${String(actor || "system")},
        ${String(source || "system")},
        ${String(note || "")},
        now()
      )
    `;
  } catch (error) {
    if (isMissingPaymentEventsTable(error)) {
      return false;
    }
    throw error;
  }
  return true;
}

module.exports = {
  logPaymentEvent,
};
