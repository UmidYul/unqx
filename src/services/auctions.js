const { prisma } = require("../db/prisma");

const DEMO_AUCTION = {
  id: "demo",
  slug: "VIP777",
  status: "active",
  startingPrice: 1_000_000,
  minStep: 50_000,
  currentBid: 1_500_000,
  leaderUserId: null,
  winnerUserId: null,
  startsAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000 + 35 * 60 * 1000).toISOString(),
  finishedAt: null,
  createdAt: new Date().toISOString(),
  leader: { name: "scxr1337", username: "scxr1337" },
  bids: [
    { id: "demo-1", amount: 1_500_000, status: "active", bidderName: "scxr1337", bidderUsername: "scxr1337", createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
    { id: "demo-2", amount: 1_400_000, status: "active", bidderName: "classic", bidderUsername: "classic", createdAt: new Date(Date.now() - 18 * 60 * 1000).toISOString() },
    { id: "demo-3", amount: 1_250_000, status: "active", bidderName: "UNQX User", bidderUsername: "unqx", createdAt: new Date(Date.now() - 42 * 60 * 1000).toISOString() },
  ],
};

function normalizeAuctionSlug(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 20);
}

function toPositiveInt(value, fallback = 0) {
  const next = Math.round(Number(value || 0));
  return Number.isFinite(next) && next > 0 ? next : fallback;
}

function toNonNegativeInt(value, fallback = 0) {
  const next = Math.round(Number(value || 0));
  return Number.isFinite(next) && next >= 0 ? next : fallback;
}

function isMissingAuctionStorage(error) {
  const message = String(error?.message || "");
  return (
    error?.code === "P2021" ||
    error?.code === "P2022" ||
    /unqx_auctions|unqx_auction_bids/i.test(message)
  );
}

function mapBid(row) {
  if (!row) return null;
  return {
    id: String(row.id || ""),
    auctionId: String(row.auctionId || row.auction_id || ""),
    userId: row.userId || row.user_id || null,
    amount: Number(row.amount || 0),
    status: String(row.status || "active"),
    bidderName: String(row.bidderName || row.bidder_name || "UNQX User"),
    bidderUsername: String(row.bidderUsername || row.bidder_username || "").replace(/^@/, ""),
    adminNote: row.adminNote || row.admin_note || null,
    createdAt: row.createdAt || row.created_at || null,
  };
}

function mapAuction(row, bids = []) {
  if (!row) return null;
  const mappedBids = bids.map(mapBid).filter(Boolean);
  const leaderBid = mappedBids.find((bid) => bid.status === "active") || null;
  return {
    id: String(row.id || ""),
    slug: normalizeAuctionSlug(row.slug || row.unqxNumber || row.unqx_number),
    status: String(row.status || "active") === "completed" ? "finished" : String(row.status || "active"),
    startingPrice: Number(row.startingPrice || row.starting_price || row.startPrice || row.start_price || 0),
    minStep: Number(row.minStep || row.min_step || 0),
    currentBid: Number(row.currentBid || row.current_bid || row.currentPrice || row.current_price || 0),
    leaderUserId: row.leaderUserId || row.leader_user_id || null,
    winnerUserId: row.winnerUserId || row.winner_user_id || null,
    startsAt: row.startsAt || row.starts_at || null,
    endsAt: row.endsAt || row.ends_at || null,
    finishedAt: row.finishedAt || row.finished_at || null,
    createdAt: row.createdAt || row.created_at || null,
    leader: leaderBid
      ? { name: leaderBid.bidderName, username: leaderBid.bidderUsername }
      : null,
    bids: mappedBids,
  };
}

async function syncExpiredAuctions(tx = prisma) {
  await tx.$executeRaw`
    WITH expired AS (
      SELECT id
      FROM unqx_auctions
      WHERE status = 'active' AND ends_at <= now()
    ),
    winners AS (
      SELECT DISTINCT ON (b.auction_id)
        b.auction_id,
        b.id AS bid_id,
        b.user_id,
        b.bidder_username,
        b.amount
      FROM unqx_auction_bids b
      JOIN expired e ON e.id = b.auction_id
      WHERE b.status = 'active'
      ORDER BY b.auction_id, b.amount DESC, b.created_at ASC
    )
    UPDATE unqx_auctions a
    SET
      status = 'completed',
      finished_at = COALESCE(a.finished_at, now()),
      winner_user_id = w.user_id,
      winning_bid_id = w.bid_id,
      leader_user_id = w.user_id,
      leader_username = w.bidder_username,
      current_bid = COALESCE(w.amount, a.current_bid),
      current_price = COALESCE(w.amount, a.current_price, a.current_bid),
      updated_at = now()
    FROM expired e
    LEFT JOIN winners w ON w.auction_id = e.id
    WHERE a.id = e.id
  `;
}

async function fetchBids(auctionId, limit = 5, includeBanned = false, tx = prisma) {
  const take = Math.max(1, Math.min(100, Number(limit || 5)));
  const rows = includeBanned
    ? await tx.$queryRaw`
        SELECT id, auction_id AS "auctionId", user_id AS "userId", bidder_name AS "bidderName",
               bidder_username AS "bidderUsername", amount, status, admin_note AS "adminNote", created_at AS "createdAt"
        FROM unqx_auction_bids
        WHERE auction_id = ${auctionId}::uuid
        ORDER BY created_at DESC
        LIMIT ${take}
      `
    : await tx.$queryRaw`
        SELECT id, auction_id AS "auctionId", user_id AS "userId", bidder_name AS "bidderName",
               bidder_username AS "bidderUsername", amount, status, admin_note AS "adminNote", created_at AS "createdAt"
        FROM unqx_auction_bids
        WHERE auction_id = ${auctionId}::uuid AND status = 'active'
        ORDER BY created_at DESC
        LIMIT ${take}
      `;
  return Array.isArray(rows) ? rows : [];
}

async function getActiveAuction({ fallbackDemo = true } = {}) {
  try {
    await syncExpiredAuctions();
    const rows = await prisma.$queryRaw`
      SELECT id, slug, unqx_number AS "unqxNumber", status, starting_price AS "startingPrice", start_price AS "startPrice", min_step AS "minStep",
             current_bid AS "currentBid", leader_user_id AS "leaderUserId", winner_user_id AS "winnerUserId",
             current_price AS "currentPrice", starts_at AS "startsAt", ends_at AS "endsAt", finished_at AS "finishedAt", created_at AS "createdAt"
      FROM unqx_auctions
      WHERE status = 'active' AND starts_at <= now() AND ends_at > now()
      ORDER BY ends_at ASC, created_at DESC
      LIMIT 1
    `;
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return fallbackDemo ? DEMO_AUCTION : null;
    const bids = await fetchBids(row.id, 5);
    return mapAuction(row, bids);
  } catch (error) {
    if (isMissingAuctionStorage(error)) return fallbackDemo ? DEMO_AUCTION : null;
    throw error;
  }
}

async function listAdminAuctions() {
  try {
    await syncExpiredAuctions();
    const rows = await prisma.$queryRaw`
      SELECT id, slug, unqx_number AS "unqxNumber", status, starting_price AS "startingPrice", start_price AS "startPrice", min_step AS "minStep",
             current_bid AS "currentBid", leader_user_id AS "leaderUserId", winner_user_id AS "winnerUserId",
             current_price AS "currentPrice", starts_at AS "startsAt", ends_at AS "endsAt", finished_at AS "finishedAt", created_at AS "createdAt"
      FROM unqx_auctions
      ORDER BY
        CASE status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 WHEN 'finished' THEN 2 WHEN 'completed' THEN 2 ELSE 3 END,
        created_at DESC
      LIMIT 30
    `;
    const auctions = [];
    for (const row of Array.isArray(rows) ? rows : []) {
      const bids = await fetchBids(row.id, 50, true);
      auctions.push(mapAuction(row, bids));
    }
    return auctions;
  } catch (error) {
    if (isMissingAuctionStorage(error)) return [];
    throw error;
  }
}

async function createAuction(input, adminSession) {
  const slug = normalizeAuctionSlug(input.slug);
  if (!slug) {
    const error = new Error("Укажи UNQX для аукциона.");
    error.status = 400;
    throw error;
  }
  const startingPrice = toNonNegativeInt(input.startingPrice, 0);
  const minStep = toPositiveInt(input.minStep, 50_000);
  const durationHours = Math.max(1, Math.min(24 * 30, toPositiveInt(input.durationHours, 24)));
  const now = new Date();
  const endsAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
  const createdBy = String(adminSession?.name || adminSession?.role || "admin").slice(0, 80);

  const rows = await prisma.$queryRaw`
    INSERT INTO unqx_auctions (slug, unqx_number, status, starting_price, start_price, min_step, current_bid, current_price, starts_at, start_date, ends_at, end_date, created_by_admin)
    VALUES (${slug}, ${slug}, 'active', ${startingPrice}, ${startingPrice}, ${minStep}, 0, 0, now(), now(), ${endsAt}, ${endsAt}, ${createdBy})
    RETURNING id, slug, unqx_number AS "unqxNumber", status, starting_price AS "startingPrice", start_price AS "startPrice", min_step AS "minStep",
              current_bid AS "currentBid", leader_user_id AS "leaderUserId", winner_user_id AS "winnerUserId",
              current_price AS "currentPrice", starts_at AS "startsAt", ends_at AS "endsAt", finished_at AS "finishedAt", created_at AS "createdAt"
  `;
  return mapAuction(Array.isArray(rows) ? rows[0] : null, []);
}

async function placeBid(auctionId, amount, userSession) {
  const userId = String(userSession?.userId || "").trim();
  if (!userId) {
    const error = new Error("Нужно войти, чтобы сделать ставку.");
    error.status = 401;
    throw error;
  }
  const bidAmount = toPositiveInt(amount, 0);
  if (!bidAmount) {
    const error = new Error("Введите корректную ставку.");
    error.status = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    await syncExpiredAuctions(tx);
    const rows = await tx.$queryRaw`
      SELECT id, slug, unqx_number AS "unqxNumber", status, starting_price AS "startingPrice", start_price AS "startPrice", min_step AS "minStep",
             current_bid AS "currentBid", current_price AS "currentPrice", leader_user_id AS "leaderUserId", leader_username AS "leaderUsername", winner_user_id AS "winnerUserId",
             starts_at AS "startsAt", ends_at AS "endsAt", finished_at AS "finishedAt", created_at AS "createdAt"
      FROM unqx_auctions
      WHERE id = ${auctionId}::uuid
      FOR UPDATE
      LIMIT 1
    `;
    const auction = Array.isArray(rows) ? rows[0] : null;
    if (!auction || auction.status !== "active" || new Date(auction.endsAt).getTime() <= Date.now()) {
      const error = new Error("Аукцион завершен.");
      error.status = 409;
      throw error;
    }
    const currentBid = Number(auction.currentBid || 0);
    const minNext = currentBid > 0
      ? currentBid + Number(auction.minStep || 0)
      : Number(auction.startingPrice || 0);
    if (bidAmount < minNext) {
      const error = new Error(`Минимальная ставка: ${minNext.toLocaleString("ru-RU")} сум.`);
      error.status = 400;
      error.minNextBid = minNext;
      throw error;
    }

    const userRows = await tx.$queryRaw`
      SELECT
        COALESCE(NULLIF(pc.name, ''), NULLIF(u.display_name, ''), NULLIF(u.first_name, ''), NULLIF(u.login, ''), 'UNQX User') AS name,
        COALESCE(NULLIF(u.username, ''), NULLIF(u.telegram_username, ''), NULLIF(u.login, '')) AS username
      FROM users u
      LEFT JOIN profile_cards pc ON pc.owner_id = u.id
      WHERE u.id = ${userId}
      LIMIT 1
    `;
    const user = Array.isArray(userRows) ? userRows[0] : null;
    const bidderName = String(user?.name || userSession?.firstName || "UNQX User").slice(0, 120);
    const bidderUsername = String(user?.username || userSession?.login || "").replace(/^@/, "").slice(0, 80) || null;

    await tx.$queryRaw`
      INSERT INTO unqx_auction_bids (auction_id, user_id, bidder_name, bidder_username, amount)
      VALUES (${auctionId}::uuid, ${userId}, ${bidderName}, ${bidderUsername}, ${bidAmount})
    `;
    await tx.$executeRaw`
      UPDATE unqx_auctions
      SET current_bid = ${bidAmount},
          current_price = ${bidAmount},
          leader_user_id = ${userId},
          previous_leader_username = leader_username,
          leader_username = ${bidderUsername || bidderName},
          updated_at = now()
      WHERE id = ${auctionId}::uuid
    `;

    const freshRows = await tx.$queryRaw`
      SELECT id, slug, unqx_number AS "unqxNumber", status, starting_price AS "startingPrice", start_price AS "startPrice", min_step AS "minStep",
             current_bid AS "currentBid", leader_user_id AS "leaderUserId", winner_user_id AS "winnerUserId",
             current_price AS "currentPrice", starts_at AS "startsAt", ends_at AS "endsAt", finished_at AS "finishedAt", created_at AS "createdAt"
      FROM unqx_auctions
      WHERE id = ${auctionId}::uuid
      LIMIT 1
    `;
    const bids = await fetchBids(auctionId, 5, false, tx);
    return mapAuction(Array.isArray(freshRows) ? freshRows[0] : null, bids);
  });
}

async function banBid(bidId, adminNote = "") {
  return prisma.$transaction(async (tx) => {
    const bidRows = await tx.$queryRaw`
      UPDATE unqx_auction_bids
      SET status = 'banned', admin_note = ${String(adminNote || "").slice(0, 300)}
      WHERE id = ${bidId}::uuid
      RETURNING auction_id AS "auctionId"
    `;
    const auctionId = Array.isArray(bidRows) ? bidRows[0]?.auctionId : null;
    if (!auctionId) return null;

    const leaderRows = await tx.$queryRaw`
      SELECT id, user_id AS "userId", bidder_username AS "bidderUsername", amount
      FROM unqx_auction_bids
      WHERE auction_id = ${auctionId}::uuid AND status = 'active'
      ORDER BY amount DESC, created_at ASC
      LIMIT 1
    `;
    const leader = Array.isArray(leaderRows) ? leaderRows[0] : null;
    await tx.$executeRaw`
      UPDATE unqx_auctions
      SET current_bid = ${leader ? Number(leader.amount || 0) : 0},
          current_price = ${leader ? Number(leader.amount || 0) : 0},
          leader_user_id = ${leader ? leader.userId : null},
          leader_username = ${leader ? leader.bidderUsername : null},
          winner_user_id = CASE WHEN status IN ('finished', 'completed') THEN ${leader ? leader.userId : null} ELSE winner_user_id END,
          winning_bid_id = CASE WHEN status IN ('finished', 'completed') THEN ${leader ? leader.id : null}::uuid ELSE winning_bid_id END,
          updated_at = now()
      WHERE id = ${auctionId}::uuid
    `;
    const rows = await tx.$queryRaw`
      SELECT id, slug, unqx_number AS "unqxNumber", status, starting_price AS "startingPrice", start_price AS "startPrice", min_step AS "minStep",
             current_bid AS "currentBid", current_price AS "currentPrice", leader_user_id AS "leaderUserId", winner_user_id AS "winnerUserId",
             starts_at AS "startsAt", ends_at AS "endsAt", finished_at AS "finishedAt", created_at AS "createdAt"
      FROM unqx_auctions WHERE id = ${auctionId}::uuid LIMIT 1
    `;
    const bids = await fetchBids(auctionId, 50, true, tx);
    return mapAuction(Array.isArray(rows) ? rows[0] : null, bids);
  });
}

async function finishAuction(auctionId) {
  await prisma.$executeRaw`
    UPDATE unqx_auctions
    SET ends_at = LEAST(ends_at, now()), end_date = LEAST(COALESCE(end_date, ends_at), now()), updated_at = now()
    WHERE id = ${auctionId}::uuid
  `;
  await syncExpiredAuctions();
  const rows = await prisma.$queryRaw`
    SELECT id, slug, unqx_number AS "unqxNumber", status, starting_price AS "startingPrice", start_price AS "startPrice", min_step AS "minStep",
           current_bid AS "currentBid", current_price AS "currentPrice", leader_user_id AS "leaderUserId", winner_user_id AS "winnerUserId",
           starts_at AS "startsAt", ends_at AS "endsAt", finished_at AS "finishedAt", created_at AS "createdAt"
    FROM unqx_auctions WHERE id = ${auctionId}::uuid LIMIT 1
  `;
  const bids = await fetchBids(auctionId, 50, true);
  return mapAuction(Array.isArray(rows) ? rows[0] : null, bids);
}

module.exports = {
  normalizeAuctionSlug,
  getActiveAuction,
  listAdminAuctions,
  createAuction,
  placeBid,
  banBid,
  finishAuction,
  isMissingAuctionStorage,
};
