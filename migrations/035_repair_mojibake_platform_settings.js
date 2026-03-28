const path = require("node:path");

const { DEFAULT_SETTINGS } = require(path.join(__dirname, "..", "src", "services", "platform-settings"));

const MOJIBAKE_PATTERN = /(?:Р.|С.){3,}|пїЅ|�/u;
const REPAIR_MARKER = "system:mojibake_repair_035";

function isCorruptedString(value) {
  return typeof value === "string" && MOJIBAKE_PATTERN.test(value);
}

async function decodeCp1251Utf8(client, value) {
  try {
    const { rows } = await client.query(
      "SELECT convert_from(convert_to($1, 'WIN1251'), 'UTF8') AS fixed",
      [value],
    );
    const fixed = rows?.[0]?.fixed;
    return typeof fixed === "string" ? fixed : value;
  } catch {
    return value;
  }
}

async function repairString(client, value, fallback) {
  if (typeof value !== "string" || !isCorruptedString(value)) {
    return { value, changed: false };
  }

  let next = await decodeCp1251Utf8(client, value);
  if (isCorruptedString(next) && typeof fallback === "string" && !isCorruptedString(fallback)) {
    next = fallback;
  }

  return { value: next, changed: next !== value };
}

async function repairJsonValue(client, value, fallback) {
  if (typeof value === "string") {
    return repairString(client, value, typeof fallback === "string" ? fallback : undefined);
  }

  if (Array.isArray(value)) {
    const fallbackArray = Array.isArray(fallback) ? fallback : [];
    let changed = false;
    const next = [];
    for (let index = 0; index < value.length; index += 1) {
      const repaired = await repairJsonValue(client, value[index], fallbackArray[index]);
      next.push(repaired.value);
      changed = changed || repaired.changed;
    }
    return { value: changed ? next : value, changed };
  }

  if (value && typeof value === "object") {
    const fallbackObject = fallback && typeof fallback === "object" && !Array.isArray(fallback) ? fallback : {};
    let changed = false;
    const next = {};
    for (const [key, item] of Object.entries(value)) {
      const repaired = await repairJsonValue(client, item, fallbackObject[key]);
      next[key] = repaired.value;
      changed = changed || repaired.changed;
    }
    return { value: changed ? next : value, changed };
  }

  return { value, changed: false };
}

module.exports = {
  id: "035_repair_mojibake_platform_settings",
  async up(client) {
    const defaultsByKey = new Map(DEFAULT_SETTINGS.map((item) => [String(item.key || ""), item]));

    let rows = [];
    try {
      const result = await client.query(`
        SELECT key, label, description, value
        FROM platform_settings
      `);
      rows = result.rows || [];
    } catch (error) {
      if (error?.code === "42P01") {
        return;
      }
      throw error;
    }

    for (const row of rows) {
      const key = String(row.key || "");
      const fallback = defaultsByKey.get(key) || null;

      const labelRepair = await repairString(client, row.label, fallback?.label);
      const descriptionRepair = await repairString(client, row.description, fallback?.description);
      const valueRepair = await repairJsonValue(client, row.value, fallback?.value);

      const valueLooksCorrupted = isCorruptedString(JSON.stringify(row.value ?? ""));
      const decodedLooksCorrupted = isCorruptedString(JSON.stringify(valueRepair.value ?? ""));
      const fallbackValueAvailable = Object.prototype.hasOwnProperty.call(fallback || {}, "value");
      const useFallbackValue = valueLooksCorrupted && decodedLooksCorrupted && fallbackValueAvailable;

      const nextValue = useFallbackValue ? fallback.value : valueRepair.value;
      const valueChanged = useFallbackValue ? JSON.stringify(nextValue) !== JSON.stringify(row.value) : valueRepair.changed;

      const labelChanged = labelRepair.changed;
      const descriptionChanged = descriptionRepair.changed;
      const hasChanges = labelChanged || descriptionChanged || valueChanged;

      if (!hasChanges) {
        continue;
      }

      await client.query(
        `
          UPDATE platform_settings
          SET
            label = $2,
            description = $3,
            value = $4::jsonb,
            updated_by = $5,
            updated_at = now()
          WHERE key = $1
        `,
        [
          key,
          labelRepair.value,
          descriptionRepair.value,
          JSON.stringify(nextValue),
          REPAIR_MARKER,
        ],
      );
    }
  },
};
