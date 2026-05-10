const { getManySettings } = require("./platform-settings");
const { getOrderPaymentReference, normalizeTelegramUsername } = require("./payment-flow");

const PET_PRESETS = [
  {
    id: "kitten",
    label: "Котенок",
    description: "Маленький спутник для визитки",
    settingKey: "pet_kitten_price",
    defaultPrice: 2_000_000,
    assetUrl: "/assets/pets/kitten.svg",
  },
  {
    id: "puppy",
    label: "Песик",
    description: "Верный друг рядом с профилем",
    settingKey: "pet_puppy_price",
    defaultPrice: 5_000_000,
    assetUrl: "/assets/pets/puppy.svg",
  },
  {
    id: "snake",
    label: "Змея",
    description: "Редкий декоративный питомец",
    settingKey: "pet_snake_price",
    defaultPrice: 7_000_000,
    assetUrl: "/assets/pets/snake.svg",
  },
];

const PET_TYPE_SET = new Set(PET_PRESETS.map((item) => item.id));
const PET_SETTING_KEYS = PET_PRESETS.map((item) => item.settingKey);

function toBool(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === 1 || value === "1" || value === "t" || value === "true") return true;
  if (value === 0 || value === "0" || value === "f" || value === "false") return false;
  return fallback;
}

function normalizePetType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return PET_TYPE_SET.has(normalized) ? normalized : "";
}

function getPetPreset(type) {
  const normalizedType = normalizePetType(type);
  return PET_PRESETS.find((item) => item.id === normalizedType) || null;
}

function getPetSettingKey(type) {
  const preset = getPetPreset(type);
  return preset ? preset.settingKey : "";
}

function getPetTypeLabel(type) {
  const preset = getPetPreset(type);
  return preset ? preset.label : String(type || "").trim();
}

function normalizePetDisplayName(value, { maxLength = 120 } = {}) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function resolvePetDisplayName(value, petType) {
  const normalized = normalizePetDisplayName(value);
  return normalized || getPetTypeLabel(petType);
}

function toPetPrice(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Math.round(Number(fallback || 0)));
  }
  return Math.max(0, Math.round(parsed));
}

function buildPetCatalog(prices = {}) {
  return PET_PRESETS.map((item) => ({
    id: item.id,
    petType: item.id,
    label: item.label,
    description: item.description,
    assetUrl: item.assetUrl,
    settingKey: item.settingKey,
    defaultPrice: item.defaultPrice,
    price: toPetPrice(prices[item.settingKey], item.defaultPrice),
  }));
}

async function getPetCatalog() {
  const values = await getManySettings(PET_SETTING_KEYS);
  return buildPetCatalog(values || {});
}

function getPetPriceFromCatalog(catalog, petType) {
  const normalizedType = normalizePetType(petType);
  const item = Array.isArray(catalog)
    ? catalog.find((entry) => String(entry?.petType || entry?.id || "").trim().toLowerCase() === normalizedType)
    : null;
  if (!item) {
    const preset = getPetPreset(normalizedType);
    return preset ? preset.defaultPrice : 0;
  }
  return toPetPrice(item.price, item.defaultPrice);
}

function mapProfileCardPet(row) {
  if (!row) return null;
  const petType = normalizePetType(row.petType ?? row.pet_type);
  if (!petType) return null;
  const preset = getPetPreset(petType);
  return {
    id: String(row.id || "").trim(),
    profileCardId: row.profileCardId ?? row.profile_card_id ?? null,
    userId: row.userId ?? row.user_id ?? null,
    petType,
    label: preset?.label || petType,
    assetUrl: preset?.assetUrl || "",
    displayName: resolvePetDisplayName(row.displayName ?? row.display_name, petType),
    priceSnapshot: toPetPrice(row.priceSnapshot ?? row.price_snapshot, preset?.defaultPrice || 0),
    isVisible: toBool(row.isVisible ?? row.is_visible, true),
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
  };
}

function sortProfileCardPets(items) {
  return (Array.isArray(items) ? items : [])
    .map(mapProfileCardPet)
    .filter(Boolean)
    .sort((a, b) => {
      const timeA = new Date(a.createdAt || 0).getTime();
      const timeB = new Date(b.createdAt || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });
}

function getVisibleProfileCardPets(items) {
  return sortProfileCardPets(items).filter((item) => item.isVisible);
}

function toPetRequestStatusBadge(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "approved") return "Активировано";
  if (normalized === "rejected") return "Отклонено";
  return "Ожидает оплаты";
}

function buildPetPaymentUrl({
  requestId,
  petType,
  displayName,
  priceSnapshot,
  telegramUsername = "unqx_uz",
  fullName = "",
  email = "",
  paymentReference = "",
}) {
  const safeUsername = normalizeTelegramUsername(telegramUsername);
  const petLabel = getPetTypeLabel(petType);
  const petName = resolvePetDisplayName(displayName, petType);
  const reference = String(paymentReference || "").trim() || getOrderPaymentReference(requestId);
  const resolvedEmail = String(email || "").trim() || "не указан";
  const resolvedName = String(fullName || "").trim() || "не указано";
  const amount = toPetPrice(priceSnapshot);
  const message =
    `Здравствуйте! Хочу оплатить питомца #️⃣ ${reference}\n\n` +
    `Питомец: ${petLabel}\n` +
    `Имя питомца: ${petName}\n` +
    `ФИО: ${resolvedName}\n` +
    `Email: ${resolvedEmail}\n\n` +
    `💳 Детализация оплаты:\n` +
    `• ${petLabel} "${petName}": ${Number(amount).toLocaleString("ru-RU")} сум\n\n` +
    `Итого к оплате: ${Number(amount).toLocaleString("ru-RU")} сум`;
  return `https://t.me/${safeUsername}?text=${encodeURIComponent(message)}`;
}

function mapPetPurchaseRequest(row) {
  if (!row) return null;
  const petType = normalizePetType(row.petType ?? row.pet_type);
  if (!petType) return null;
  const priceSnapshot = toPetPrice(row.priceSnapshot ?? row.price_snapshot, getPetPreset(petType)?.defaultPrice || 0);
  return {
    id: String(row.id || "").trim(),
    type: "pet",
    petType,
    petLabel: getPetTypeLabel(petType),
    displayName: resolvePetDisplayName(row.displayName ?? row.display_name, petType),
    priceSnapshot,
    totalOneTime: priceSnapshot,
    status: String(row.status || "").trim().toLowerCase() || "pending",
    statusBadge: toPetRequestStatusBadge(row.status),
    adminNote: row.adminNote ?? row.admin_note ?? "",
    paymentReference: String((row.paymentReference ?? row.payment_reference) || "").trim(),
    paymentUrl: String((row.paymentUrl ?? row.payment_url) || "").trim(),
    createdAt: row.createdAt ?? row.created_at ?? row.requestedAt ?? row.requested_at ?? null,
    purchasedAt: String(row.status || "").trim().toLowerCase() === "approved"
      ? (row.reviewedAt ?? row.reviewed_at ?? null)
      : null,
    requestedAt: row.requestedAt ?? row.requested_at ?? row.createdAt ?? row.created_at ?? null,
    reviewedAt: row.reviewedAt ?? row.reviewed_at ?? null,
  };
}

module.exports = {
  PET_PRESETS,
  PET_SETTING_KEYS,
  PET_TYPE_SET,
  normalizePetType,
  getPetPreset,
  getPetSettingKey,
  getPetTypeLabel,
  normalizePetDisplayName,
  resolvePetDisplayName,
  toPetPrice,
  buildPetCatalog,
  getPetCatalog,
  getPetPriceFromCatalog,
  mapProfileCardPet,
  sortProfileCardPets,
  getVisibleProfileCardPets,
  toPetRequestStatusBadge,
  buildPetPaymentUrl,
  mapPetPurchaseRequest,
};
