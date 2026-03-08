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
  getPaymentConfig,
  buildOrderPaymentDraft,
};
