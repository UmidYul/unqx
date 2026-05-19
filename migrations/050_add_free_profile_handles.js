const { randomInt } = require("node:crypto");

const ACTIVE_SLUG_STATUSES = ["approved", "active", "paused", "private"];

function buildDefaultCardName(row) {
  const displayName = String(row?.display_name || "").trim().slice(0, 120);
  if (displayName) {
    return displayName;
  }
  const firstName = String(row?.first_name || "").trim().slice(0, 120);
  return firstName || "UNQX User";
}

function generateFreeProfileCodeCandidate() {
  let out = String(randomInt(1, 10));
  for (let index = 0; index < 11; index += 1) {
    out += String(randomInt(0, 10));
  }
  return out;
}

async function generateUniqueFreeProfileCode(client) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = generateFreeProfileCodeCandidate();
    const { rows } = await client.query(
      `
        SELECT 1
        FROM users
        WHERE free_profile_code = $1
        LIMIT 1
      `,
      [candidate],
    );
    if (!rows.length) {
      return candidate;
    }
  }
  throw new Error("Failed to generate a unique FREE profile code");
}

module.exports = {
  id: "050_add_free_profile_handles",
  async up(client) {
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS free_profile_code VARCHAR(12)
    `);
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS free_profile_status VARCHAR(20) NOT NULL DEFAULT 'active'
    `);
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS free_profile_pause_message VARCHAR(220)
    `);
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS free_profile_disabled_at TIMESTAMPTZ
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_free_profile_code_key
      ON users (free_profile_code)
      WHERE free_profile_code IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS users_free_profile_status_disabled_idx
      ON users (free_profile_status, free_profile_disabled_at)
    `);

    await client.query(`
      UPDATE users
      SET free_profile_status = 'active'
      WHERE free_profile_code IS NOT NULL
        AND COALESCE(NULLIF(TRIM(free_profile_status), ''), '') = ''
    `);

    const { rows } = await client.query(
      `
        SELECT
          u.id,
          u.first_name,
          u.display_name,
          u.free_profile_code
        FROM users u
        WHERE u.status = 'active'
          AND NOT EXISTS (
            SELECT 1
            FROM slugs s
            WHERE s.owner_id = u.id
              AND s.status = ANY($1::text[])
          )
      `,
      [ACTIVE_SLUG_STATUSES],
    );

    for (const row of rows) {
      const currentCode = String(row?.free_profile_code || "").trim();
      const code = currentCode || (await generateUniqueFreeProfileCode(client));
      if (!currentCode) {
        await client.query(
          `
            UPDATE users
            SET
              free_profile_code = $2,
              free_profile_status = COALESCE(NULLIF(TRIM(free_profile_status), ''), 'active'),
              free_profile_disabled_at = NULL
            WHERE id = $1
          `,
          [row.id, code],
        );
      }

      await client.query(
        `
          INSERT INTO profile_cards (
            owner_id,
            name,
            tags,
            buttons,
            theme,
            show_branding,
            created_at,
            updated_at
          )
          SELECT
            $1::uuid,
            $2,
            '[]'::jsonb,
            '[]'::jsonb,
            'default_dark',
            TRUE,
            now(),
            now()
          WHERE NOT EXISTS (
            SELECT 1
            FROM profile_cards
            WHERE owner_id = $1::uuid
          )
        `,
        [row.id, buildDefaultCardName(row)],
      );
    }
  },
};
