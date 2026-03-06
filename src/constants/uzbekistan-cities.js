const UZBEKISTAN_CITY_OPTIONS = [
    "Ташкент",
    "Нукус",
    "Андижан",
    "Бухара",
    "Фергана",
    "Джизак",
    "Наманган",
    "Навои",
    "Карши",
    "Самарканд",
    "Гулистан",
    "Термез",
    "Ургенч",
    "Нурафшан",
];

const CITY_ALIAS_TO_CANONICAL = {
    tashkent: "Ташкент",
    toshkent: "Ташкент",
    nukus: "Нукус",
    andijan: "Андижан",
    andijon: "Андижан",
    bukhara: "Бухара",
    buxoro: "Бухара",
    fergana: "Фергана",
    ferghana: "Фергана",
    jizzakh: "Джизак",
    djizzak: "Джизак",
    namangan: "Наманган",
    navoiy: "Навои",
    navoi: "Навои",
    qarshi: "Карши",
    karshi: "Карши",
    samarkand: "Самарканд",
    samarqand: "Самарканд",
    gulistan: "Гулистан",
    termiz: "Термез",
    termez: "Термез",
    urgench: "Ургенч",
    urganch: "Ургенч",
    nurafshon: "Нурафшан",
    nurafshan: "Нурафшан",
};

const CITY_NORMALIZED_MAP = Object.fromEntries(
    UZBEKISTAN_CITY_OPTIONS.map((city) => [city.toLowerCase(), city]),
);

function resolveUzbekistanCity(value) {
    const normalized = String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
    if (!normalized) {
        return "";
    }
    return CITY_NORMALIZED_MAP[normalized] || CITY_ALIAS_TO_CANONICAL[normalized] || "";
}

module.exports = {
    UZBEKISTAN_CITY_OPTIONS,
    resolveUzbekistanCity,
};
