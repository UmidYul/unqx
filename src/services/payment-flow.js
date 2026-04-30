const { getManySettings } = require("./platform-settings");

const SUPPORTED_PAYMENT_PROVIDERS = ["manual_tg", "click", "payme"];

function normalizePaymentProvider(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  if (SUPPORTED_PAYMENT_PROVIDERS.includes(normalized)) {
    return normalized;
  }
  return "manual_tg";
}

function toProviderLabel(provider) {
  if (provider === "click") return "Click";
  if (provider === "payme") return "Payme";
  return "Ручная оплата через Telegram";
}

function getOrderPaymentReference(orderId) {
  const compact = String(orderId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 10)
    .toUpperCase();
  return `UNQX-${compact || "ORDER"}`;
}

function normalizeTelegramUsername(value) {
  const normalized = String(value || "")
    .replace(/^@+/, "")
    .trim()
    .replace(/[^a-zA-Z0-9_]/g, "");
  return normalized || "unqx_uz";
}

function toPlanLabel(plan) {
  return String(plan || "").toLowerCase() === "premium" ? "Премиум" : "Базовый";
}

function toMoneyLabel(value) {
  return `${Number(value || 0).toLocaleString("ru-RU")} сум`;
}

function toUsdLabel(value) {
  const normalized = Number(value || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return "$2";
  }
  const amount = Number.isInteger(normalized)
    ? String(normalized)
    : normalized.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  return `$${amount}`;
}

function shouldUsePremiumUsdLabel(requestedPlan, planPrice) {
  return String(requestedPlan || "").toLowerCase() === "premium" && Number(planPrice || 0) > 0;
}

function toTelegramPlanPriceLabel({
  requestedPlan,
  planPrice = 0,
  planMonthlyPriceUsd = 2,
}) {
  if (shouldUsePremiumUsdLabel(requestedPlan, planPrice)) {
    return toUsdLabel(planMonthlyPriceUsd);
  }
  return toMoneyLabel(planPrice);
}

function toTelegramTotalPriceLabel({
  requestedPlan,
  slugPrice = 0,
  planPrice = 0,
  bracelet = false,
  braceletPrice = 0,
  totalAmount = null,
  planMonthlyPriceUsd = 2,
}) {
  const slugPart = Math.max(0, Number(slugPrice || 0));
  const planPart = Math.max(0, Number(planPrice || 0));
  const braceletPart = bracelet ? Math.max(0, Number(braceletPrice || 0)) : 0;
  const resolvedTotal =
    totalAmount == null ? slugPart + planPart + braceletPart : Math.max(0, Number(totalAmount || 0));

  if (shouldUsePremiumUsdLabel(requestedPlan, planPart) && slugPart <= 0 && braceletPart <= 0) {
    return toUsdLabel(planMonthlyPriceUsd);
  }
  return toMoneyLabel(resolvedTotal);
}

function toNameLabel(value) {
  const normalized = String(value || "").trim();
  return normalized || "не указано";
}

function buildManualTelegramPaymentUrl({
  orderId,
  slug,
  requestedPlan,
  reference,
  telegramUsername = "unqx_uz",
  fullName = "",
  email = "",
  slugPrice = 0,
  slugPriceBeforeDiscount = null,
  inviteeDiscountApplied = 0,
  promoDiscountApplied = 0,
  promoCode = "",
  bonusSpent = 0,
  planPrice = 0,
  bracelet = false,
  braceletPrice = 0,
  totalAmount = null,
  planMonthlyPriceUsd = 2,
}) {
  const safeUsername = normalizeTelegramUsername(telegramUsername);
  const paymentReference = String(reference || "").trim() || getOrderPaymentReference(orderId);
  const safeSlug = String(slug || "").trim().toUpperCase();
  const normalizedEmail = String(email || "").trim() || "не указан";
  const slugPart = Math.max(0, Number(slugPrice || 0));
  const planPart = Math.max(0, Number(planPrice || 0));
  const braceletPart = bracelet ? Math.max(0, Number(braceletPrice || 0)) : 0;
  const resolvedTotal = totalAmount == null ? slugPart + planPart + braceletPart : Math.max(0, Number(totalAmount || 0));
  const slugBeforeDiscount = slugPriceBeforeDiscount == null ? slugPart : Math.max(slugPart, Math.round(Number(slugPriceBeforeDiscount || 0)));
  const inviteeDiscountPart = Math.max(0, Math.round(Number(inviteeDiscountApplied || 0)));
  const promoDiscountPart = Math.max(0, Math.round(Number(promoDiscountApplied || 0)));
  const promoLabel = String(promoCode || "").trim();
  const bonusSpentPart = Math.max(0, Math.round(Number(bonusSpent || 0)));
  const planPriceLabel = toTelegramPlanPriceLabel({
    requestedPlan,
    planPrice: planPart,
    planMonthlyPriceUsd,
  });
  const totalPriceLabel = toTelegramTotalPriceLabel({
    requestedPlan,
    slugPrice: slugPart,
    planPrice: planPart,
    bracelet,
    braceletPrice: braceletPart,
    totalAmount: resolvedTotal,
    planMonthlyPriceUsd,
  });
  const message =
    `Здравствуйте! Хочу оплатить заказ #️⃣ ${paymentReference}\n\n` +
    `UNQ: ${safeSlug}\n` +
    `ФИО: ${toNameLabel(fullName)}\n` +
    `Email: ${normalizedEmail}\n\n` +
    `💳 Детализация оплаты:\n` +
    `• Slug ${safeSlug}: ${toMoneyLabel(slugPart)}\n` +
    (slugBeforeDiscount > slugPart ? `• База slug: ${toMoneyLabel(slugBeforeDiscount)}\n` : "") +
    (inviteeDiscountPart > 0 ? `• Реферальная скидка: -${toMoneyLabel(inviteeDiscountPart)}\n` : "") +
    (promoDiscountPart > 0 ? `• Скидка по промокоду${promoLabel ? ` (${promoLabel})` : ""}: -${toMoneyLabel(promoDiscountPart)}\n` : "") +
    (bonusSpentPart > 0 ? `• Списано бонусов: -${toMoneyLabel(bonusSpentPart)}\n` : "") +
    `• Тариф ${toPlanLabel(requestedPlan)}: ${planPriceLabel}\n` +
    `• Браслет: ${toMoneyLabel(braceletPart)}\n\n` +
    `Итого к оплате: ${totalPriceLabel}`;
  return `https://t.me/${safeUsername}?text=${encodeURIComponent(message)}`;
}

async function getPaymentConfig() {
  const values = await getManySettings([
    "payment_provider",
    "payment_manual_instructions",
    "payment_click_merchant_id",
    "payment_payme_merchant_id",
  ]);

  const provider = normalizePaymentProvider(values.payment_provider);
  return {
    provider,
    providerLabel: toProviderLabel(provider),
    manualInstructions: String(values.payment_manual_instructions || "").trim(),
    clickMerchantId: String(values.payment_click_merchant_id || "").trim(),
    paymeMerchantId: String(values.payment_payme_merchant_id || "").trim(),
  };
}

async function buildOrderPaymentDraft({ orderId, amount }) {
  const config = await getPaymentConfig();
  const reference = getOrderPaymentReference(orderId);
  const total = Math.max(0, Math.round(Number(amount) || 0));

  if (config.provider === "manual_tg") {
    return {
      provider: config.provider,
      providerLabel: config.providerLabel,
      mode: "manual",
      supportsWebhook: false,
      reference,
      amount: total,
      currency: "UZS",
      checkoutUrl: null,
      instructions:
        config.manualInstructions ||
        "Оплата проводится через менеджера в Telegram. Укажи код оплаты при переводе и отправь подтверждение менеджеру.",
    };
  }

  const hasMerchant =
    config.provider === "click" ? Boolean(config.clickMerchantId) : Boolean(config.paymeMerchantId);

  return {
    provider: config.provider,
    providerLabel: config.providerLabel,
    mode: "redirect",
    supportsWebhook: true,
    reference,
    amount: total,
    currency: "UZS",
    checkoutUrl: null,
    isReady: hasMerchant,
    instructions: hasMerchant
      ? `${config.providerLabel} будет доступен после включения checkout endpoint.`
      : `${config.providerLabel} пока не настроен. Используется ручная обработка админом.`,
  };
}

module.exports = {
  SUPPORTED_PAYMENT_PROVIDERS,
  normalizePaymentProvider,
  toProviderLabel,
  getOrderPaymentReference,
  normalizeTelegramUsername,
  toTelegramPlanPriceLabel,
  toTelegramTotalPriceLabel,
  buildManualTelegramPaymentUrl,
  getPaymentConfig,
  buildOrderPaymentDraft,
};
