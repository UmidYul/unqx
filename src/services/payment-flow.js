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
  return "Р СѓС‡РЅР°СЏ РѕРїР»Р°С‚Р° С‡РµСЂРµР· Telegram";
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
  planPrice = 0,
  bracelet = false,
  braceletPrice = 0,
  totalAmount = null,
}) {
  const safeUsername = normalizeTelegramUsername(telegramUsername);
  const paymentReference = String(reference || "").trim() || getOrderPaymentReference(orderId);
  const safeSlug = String(slug || "").trim().toUpperCase();
  const normalizedEmail = String(email || "").trim() || "не указан";
  const slugPart = Math.max(0, Number(slugPrice || 0));
  const planPart = Math.max(0, Number(planPrice || 0));
  const braceletPart = bracelet ? Math.max(0, Number(braceletPrice || 0)) : 0;
  const resolvedTotal = totalAmount == null ? slugPart + planPart + braceletPart : Math.max(0, Number(totalAmount || 0));
  const message =
    `Здравствуйте! Хочу оплатить заказ #️⃣ ${paymentReference}\n\n` +
    `UNQ: ${safeSlug}\n` +
    `ФИО: ${toNameLabel(fullName)}\n` +
    `Email: ${normalizedEmail}\n\n` +
    `💳 Детализация оплаты:\n` +
    `• Slug ${safeSlug}: ${toMoneyLabel(slugPart)}\n` +
    `• Тариф ${toPlanLabel(requestedPlan)}: ${toMoneyLabel(planPart)}\n` +
    `• Браслет: ${toMoneyLabel(braceletPart)}\n\n` +
    `Итого к оплате: ${toMoneyLabel(resolvedTotal)}`;
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
        "РћРїР»Р°С‚Р° РїСЂРѕРІРѕРґРёС‚СЃСЏ С‡РµСЂРµР· РјРµРЅРµРґР¶РµСЂР° РІ Telegram. РЈРєР°Р¶Рё РєРѕРґ РѕРїР»Р°С‚С‹ РїСЂРё РїРµСЂРµРІРѕРґРµ Рё РѕС‚РїСЂР°РІСЊ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РјРµРЅРµРґР¶РµСЂСѓ.",
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
      ? `${config.providerLabel} Р±СѓРґРµС‚ РґРѕСЃС‚СѓРїРµРЅ РїРѕСЃР»Рµ РІРєР»СЋС‡РµРЅРёСЏ checkout endpoint.`
      : `${config.providerLabel} РїРѕРєР° РЅРµ РЅР°СЃС‚СЂРѕРµРЅ. РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ СЂСѓС‡РЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° Р°РґРјРёРЅРѕРј.`,
  };
}

module.exports = {
  SUPPORTED_PAYMENT_PROVIDERS,
  normalizePaymentProvider,
  toProviderLabel,
  getOrderPaymentReference,
  normalizeTelegramUsername,
  buildManualTelegramPaymentUrl,
  getPaymentConfig,
  buildOrderPaymentDraft,
};

