const path = require("node:path");
const { Client } = require("pg");
const dotenv = require("dotenv");

const APP_DIR = path.join(__dirname, "..");
const ROOT_DIR = path.resolve(APP_DIR, "..");

dotenv.config({ path: path.join(APP_DIR, ".env"), override: false, quiet: true });
dotenv.config({ path: path.join(ROOT_DIR, ".env"), override: false, quiet: true });

const REQUIRED_ENUMS = {
  tariff: ["basic", "premium"],
  cardtheme: ["default_dark", "light_minimal", "gradient", "neon", "corporate"],
  orderstatus: ["NEW", "CONTACTED", "PAID", "ACTIVATED", "REJECTED"],
  slugstate: ["TAKEN", "BLOCKED"],
  checkerresult: ["AVAILABLE", "TAKEN", "BLOCKED", "INVALID"],
  braceletdeliverystatus: ["ORDERED", "SHIPPED", "DELIVERED"],
  userplan: ["basic", "premium"],
  userstatus: ["active", "blocked", "deactivated"],
  slugstatus: ["free", "pending", "approved", "active", "paused", "private", "blocked"],
  slugrequeststatus: ["new", "contacted", "paid", "approved", "rejected", "expired"],
};

const EXPECTED_COLUMNS = {
  cards: {
    slug: "VARCHAR(20) NOT NULL",
    is_active: "BOOLEAN NOT NULL DEFAULT TRUE",
    tariff: "tariff NOT NULL DEFAULT 'basic'",
    theme: "cardtheme NOT NULL DEFAULT 'default_dark'",
    avatar_url: "TEXT",
    name: "VARCHAR(100) NOT NULL",
    phone: "VARCHAR(30) NOT NULL",
    verified: "BOOLEAN NOT NULL DEFAULT FALSE",
    hashtag: "VARCHAR(50)",
    address: "TEXT",
    postcode: "VARCHAR(20)",
    email: "VARCHAR(100)",
    extra_phone: "VARCHAR(30)",
    views_count: "INTEGER NOT NULL DEFAULT 0",
    unique_views_count: "INTEGER NOT NULL DEFAULT 0",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  tags: {
    card_id: "UUID",
    label: "VARCHAR(50)",
    url: "TEXT",
    sort_order: "INTEGER",
  },
  buttons: {
    card_id: "UUID",
    label: "VARCHAR(50)",
    url: "TEXT",
    sort_order: "INTEGER",
    is_active: "BOOLEAN NOT NULL DEFAULT TRUE",
  },
  views_log: {
    card_id: "UUID",
    viewed_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
    device: "VARCHAR(20)",
    ip_hash: "VARCHAR(64)",
    is_unique: "BOOLEAN NOT NULL DEFAULT FALSE",
  },
  error_logs: {
    type: "VARCHAR(30)",
    path: "TEXT",
    message: "TEXT",
    user_agent: "TEXT",
    occurred_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  order_requests: {
    name: "VARCHAR(100)",
    slug: "VARCHAR(20)",
    slug_price: "INTEGER",
    tariff: "tariff",
    theme: "cardtheme",
    bracelet: "BOOLEAN NOT NULL DEFAULT FALSE",
    contact: "VARCHAR(120)",
    status: "orderstatus NOT NULL DEFAULT 'NEW'",
    card_id: "UUID",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  bracelet_orders: {
    order_id: "UUID",
    name: "VARCHAR(100)",
    slug: "VARCHAR(20)",
    contact: "VARCHAR(120)",
    delivery_status: "braceletdeliverystatus NOT NULL DEFAULT 'ORDERED'",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  slug_records: {
    slug: "VARCHAR(20)",
    state: "slugstate NOT NULL DEFAULT 'TAKEN'",
    owner_name: "VARCHAR(100)",
    price_override: "INTEGER",
    activation_date: "TIMESTAMPTZ",
    card_id: "UUID",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  slug_checker_logs: {
    slug: "VARCHAR(20)",
    pattern: "VARCHAR(20)",
    source: "VARCHAR(20)",
    result: "checkerresult",
    checked_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  testimonials: {
    name: "VARCHAR(100)",
    slug: "VARCHAR(20)",
    tariff: "tariff",
    text: "TEXT",
    is_visible: "BOOLEAN NOT NULL DEFAULT TRUE",
    sort_order: "INTEGER NOT NULL DEFAULT 0",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  users: {
    telegram_id: "VARCHAR(40)",
    first_name: "VARCHAR(120)",
    last_name: "VARCHAR(120)",
    username: "VARCHAR(120)",
    photo_url: "TEXT",
    display_name: "VARCHAR(120)",
    plan: "userplan NOT NULL DEFAULT 'basic'",
    plan_expires_at: "TIMESTAMPTZ",
    notifications_enabled: "BOOLEAN NOT NULL DEFAULT TRUE",
    status: "userstatus NOT NULL DEFAULT 'active'",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  slugs: {
    letters: "VARCHAR(3)",
    digits: "VARCHAR(3)",
    full_slug: "VARCHAR(20)",
    owner_telegram_id: "VARCHAR(40)",
    status: "slugstatus NOT NULL DEFAULT 'free'",
    is_primary: "BOOLEAN NOT NULL DEFAULT FALSE",
    price: "INTEGER",
    pause_message: "VARCHAR(220)",
    requested_at: "TIMESTAMPTZ",
    pending_expires_at: "TIMESTAMPTZ",
    approved_at: "TIMESTAMPTZ",
    activated_at: "TIMESTAMPTZ",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  slug_waitlist: {
    full_slug: "VARCHAR(20)",
    telegram_id: "VARCHAR(40)",
    ip_hash: "VARCHAR(64)",
    user_agent: "TEXT",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  profile_cards: {
    owner_telegram_id: "VARCHAR(40)",
    name: "VARCHAR(120)",
    role: "VARCHAR(120)",
    bio: "VARCHAR(120)",
    avatar_url: "TEXT",
    tags: "JSONB NOT NULL DEFAULT '[]'::jsonb",
    buttons: "JSONB NOT NULL DEFAULT '[]'::jsonb",
    theme: "cardtheme NOT NULL DEFAULT 'default_dark'",
    custom_color: "VARCHAR(20)",
    show_branding: "BOOLEAN NOT NULL DEFAULT TRUE",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  slug_requests: {
    telegram_id: "VARCHAR(40)",
    slug: "VARCHAR(20)",
    slug_price: "INTEGER",
    requested_plan: "userplan",
    bracelet: "BOOLEAN NOT NULL DEFAULT FALSE",
    contact: "VARCHAR(140)",
    status: "slugrequeststatus NOT NULL DEFAULT 'new'",
    admin_note: "TEXT",
    created_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
    updated_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
  },
  slug_views: {
    full_slug: "VARCHAR(20)",
    viewed_at: "TIMESTAMPTZ NOT NULL DEFAULT now()",
    device: "VARCHAR(20)",
    ip_hash: "VARCHAR(64)",
    is_unique: "BOOLEAN NOT NULL DEFAULT FALSE",
  },
};

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, "\"\"")}"`;
}

function quoteLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function hasTable(client, tableName) {
  const { rows } = await client.query(
    `
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
      LIMIT 1
    `,
    [tableName],
  );
  return rows.length > 0;
}

async function hasColumn(client, tableName, columnName) {
  const { rows } = await client.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName],
  );
  return rows.length > 0;
}

async function ensureEnums(client) {
  for (const [typeName, labels] of Object.entries(REQUIRED_ENUMS)) {
    const { rows } = await client.query(
      `
        SELECT 1
        FROM pg_type
        WHERE typname = $1
        LIMIT 1
      `,
      [typeName],
    );

    if (rows.length === 0) {
      const listSql = labels.map((label) => quoteLiteral(label)).join(", ");
      await client.query(`CREATE TYPE ${quoteIdent(typeName)} AS ENUM (${listSql})`);
    }

    for (const label of labels) {
      await client.query(
        `ALTER TYPE ${quoteIdent(typeName)} ADD VALUE IF NOT EXISTS ${quoteLiteral(label)}`,
      );
    }
  }
}

async function run() {
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL (or DIRECT_URL) is required");
  }

  const client = new Client({ connectionString });
  await client.connect();

  let added = 0;
  let skipped = 0;
  let missingTables = 0;

  try {
    await ensureEnums(client);

    for (const [tableName, columns] of Object.entries(EXPECTED_COLUMNS)) {
      const tableExists = await hasTable(client, tableName);
      if (!tableExists) {
        missingTables += 1;
        console.log(`[patch-columns] skip table "${tableName}" (not found)`);
        continue;
      }

      for (const [columnName, definition] of Object.entries(columns)) {
        const exists = await hasColumn(client, tableName, columnName);
        if (exists) {
          skipped += 1;
          continue;
        }

        await client.query(
          `ALTER TABLE ${quoteIdent(tableName)} ADD COLUMN ${quoteIdent(columnName)} ${definition}`,
        );
        added += 1;
        console.log(`[patch-columns] added ${tableName}.${columnName}`);
      }
    }

    console.log(`[patch-columns] done: added=${added}, exists=${skipped}, missing_tables=${missingTables}`);
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("[patch-columns] failed:", error);
  process.exitCode = 1;
});
