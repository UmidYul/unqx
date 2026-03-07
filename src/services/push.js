const { prisma } = require("../db/prisma");
const { env } = require("../config/env");
const { Prisma } = require("@prisma/client");

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_SEND_BATCH = 100;
const MAX_RECEIPTS_BATCH = 300;
const TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

function isStorageMissing(error) {
    if (!error || typeof error !== "object") return false;
    const code = String(error.code || "");
    return code === "42P01" || code === "42703" || code === "P2021" || code === "P2022";
}

function chunkArray(items, size) {
    const out = [];
    for (let i = 0; i < items.length; i += size) {
        out.push(items.slice(i, i + size));
    }
    return out;
}

function normalizeToken(value) {
    const token = String(value || "").trim();
    return token || null;
}

function isExpoPushToken(value) {
    return TOKEN_PATTERN.test(String(value || ""));
}

async function removeInvalidTokens(userId, tokens) {
    if (!userId || !Array.isArray(tokens) || tokens.length === 0) {
        return;
    }

    const unique = Array.from(new Set(tokens.map(normalizeToken).filter(Boolean)));
    if (!unique.length) {
        return;
    }

    for (const token of unique) {
        try {
            await prisma.$executeRaw`
        DELETE FROM push_tokens
        WHERE user_id = ${userId} AND token = ${token}
      `;
        } catch (error) {
            if (!isStorageMissing(error)) {
                throw error;
            }
            return;
        }
    }
}

function buildHeaders() {
    const headers = {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
    };

    const accessToken = String(env.EXPO_PUSH_ACCESS_TOKEN || "").trim();
    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
}

async function fetchUserPushTokens(userId, { respectNotifications = true } = {}) {
    if (!userId) {
        return [];
    }

    try {
        const rows = respectNotifications
            ? await prisma.$queryRaw`
            SELECT pt.token
            FROM push_tokens pt
            JOIN users u ON u.id = pt.user_id
            WHERE pt.user_id = ${userId}
                AND coalesce(u.notifications_enabled, true) = true
            ORDER BY pt.updated_at DESC
            LIMIT 50
        `
            : await prisma.$queryRaw`
            SELECT pt.token
            FROM push_tokens pt
            WHERE pt.user_id = ${userId}
            ORDER BY pt.updated_at DESC
            LIMIT 50
        `;

        if (!Array.isArray(rows)) {
            return [];
        }

        const normalized = rows.map((row) => normalizeToken(row?.token)).filter(Boolean);
        return Array.from(new Set(normalized));
    } catch (error) {
        if (isStorageMissing(error)) {
            return [];
        }
        throw error;
    }
}

async function fetchPushTargetsByUserIds(userIds, { respectNotifications = true } = {}) {
    const normalizedUserIds = Array.from(
        new Set(
            (Array.isArray(userIds) ? userIds : [])
                .map((value) => String(value || "").trim())
                .filter(Boolean),
        ),
    );
    if (!normalizedUserIds.length) {
        return [];
    }

    try {
        const rows = respectNotifications
            ? await prisma.$queryRaw`
            SELECT pt.user_id, pt.token
            FROM push_tokens pt
            JOIN users u ON u.id = pt.user_id
            WHERE pt.user_id IN (${Prisma.join(normalizedUserIds)})
                AND coalesce(u.notifications_enabled, true) = true
        `
            : await prisma.$queryRaw`
            SELECT pt.user_id, pt.token
            FROM push_tokens pt
            WHERE pt.user_id IN (${Prisma.join(normalizedUserIds)})
        `;

        if (!Array.isArray(rows)) {
            return [];
        }

        return rows
            .map((row) => ({
                userId: String(row?.user_id || "").trim(),
                token: normalizeToken(row?.token),
            }))
            .filter((row) => row.userId && row.token);
    } catch (error) {
        if (isStorageMissing(error)) {
            return [];
        }
        throw error;
    }
}

function shouldDisablePush() {
    const raw = String(env.EXPO_PUSH_ENABLED || "").trim().toLowerCase();
    if (!raw) {
        return false;
    }
    return raw === "0" || raw === "false" || raw === "no" || raw === "off";
}

async function sendMessagesToExpo(messages) {
    const response = await fetch(EXPO_PUSH_SEND_URL, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify(messages),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || !Array.isArray(payload.data)) {
        const text = payload ? JSON.stringify(payload) : response.statusText;
        throw new Error(`Expo push send failed (${response.status}): ${text}`);
    }

    return payload;
}

async function fetchExpoReceipts(ids) {
    const response = await fetch(EXPO_PUSH_RECEIPTS_URL, {
        method: "POST",
        headers: buildHeaders(),
        body: JSON.stringify({ ids }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || typeof payload.data !== "object" || payload.data === null) {
        const text = payload ? JSON.stringify(payload) : response.statusText;
        throw new Error(`Expo receipts failed (${response.status}): ${text}`);
    }

    return payload.data;
}

async function dispatchPushTargets(targets, payload) {
    const cleanedTargets = Array.isArray(targets)
        ? targets
            .map((item) => ({
                userId: String(item?.userId || "").trim(),
                token: normalizeToken(item?.token),
            }))
            .filter((item) => item.userId && item.token)
        : [];

    if (!cleanedTargets.length) {
        return { ok: true, sent: 0, tokens: 0, cleaned: 0, users: 0 };
    }

    const uniqueByPair = new Map();
    for (const item of cleanedTargets) {
        const key = `${item.userId}:${item.token}`;
        if (!uniqueByPair.has(key)) {
            uniqueByPair.set(key, item);
        }
    }

    const deduped = Array.from(uniqueByPair.values());
    const invalidByUser = new Map();
    const validTargets = [];
    for (const item of deduped) {
        if (isExpoPushToken(item.token)) {
            validTargets.push(item);
        } else {
            if (!invalidByUser.has(item.userId)) invalidByUser.set(item.userId, new Set());
            invalidByUser.get(item.userId).add(item.token);
        }
    }

    for (const [userId, tokenSet] of invalidByUser.entries()) {
        await removeInvalidTokens(userId, Array.from(tokenSet));
    }

    if (!validTargets.length) {
        return { ok: true, sent: 0, tokens: 0, cleaned: invalidByUser.size, users: 0 };
    }

    const messageTemplate = {
        title: String(payload?.title || "").slice(0, 120),
        body: String(payload?.body || "").slice(0, 512),
        sound: payload?.sound || "default",
        channelId: payload?.channelId || "default",
        priority: payload?.priority || "high",
        data: payload?.data && typeof payload.data === "object" ? payload.data : {},
    };

    const ticketsById = new Map();
    const deadByUser = new Map();
    let sentCount = 0;

    for (const targetChunk of chunkArray(validTargets, MAX_SEND_BATCH)) {
        const messages = targetChunk.map((target) => ({ ...messageTemplate, to: target.token }));
        const expoResponse = await sendMessagesToExpo(messages);

        expoResponse.data.forEach((ticket, index) => {
            const target = targetChunk[index];
            if (!target) {
                return;
            }

            if (ticket?.status === "ok" && ticket.id) {
                sentCount += 1;
                ticketsById.set(ticket.id, target);
                return;
            }

            const detailsError = String(ticket?.details?.error || "");
            if (detailsError === "DeviceNotRegistered" || detailsError === "ExpoPushTokenInvalid") {
                if (!deadByUser.has(target.userId)) deadByUser.set(target.userId, new Set());
                deadByUser.get(target.userId).add(target.token);
            }
        });
    }

    const receiptIds = Array.from(ticketsById.keys());
    for (const idChunk of chunkArray(receiptIds, MAX_RECEIPTS_BATCH)) {
        const receipts = await fetchExpoReceipts(idChunk);
        for (const [receiptId, receipt] of Object.entries(receipts)) {
            if (!receipt || receipt.status !== "error") {
                continue;
            }
            const detailsError = String(receipt?.details?.error || "");
            if (detailsError === "DeviceNotRegistered" || detailsError === "ExpoPushTokenInvalid") {
                const target = ticketsById.get(receiptId);
                if (target) {
                    if (!deadByUser.has(target.userId)) deadByUser.set(target.userId, new Set());
                    deadByUser.get(target.userId).add(target.token);
                }
            }
        }
    }

    let cleanedCount = 0;
    for (const [userId, tokenSet] of deadByUser.entries()) {
        const tokens = Array.from(tokenSet);
        cleanedCount += tokens.length;
        await removeInvalidTokens(userId, tokens);
    }

    return {
        ok: true,
        sent: sentCount,
        tokens: validTargets.length,
        cleaned: cleanedCount,
        users: new Set(validTargets.map((item) => item.userId)).size,
    };
}

async function sendExpoPushToUser({ userId, title, body, data = {}, sound = "default", respectNotifications = true }) {
    if (!userId || !title || !body || shouldDisablePush()) {
        return { ok: true, sent: 0, tokens: 0 };
    }

    const allTokens = await fetchUserPushTokens(userId, { respectNotifications });
    if (!allTokens.length) {
        return { ok: true, sent: 0, tokens: 0 };
    }

    const targets = allTokens.map((token) => ({ userId: String(userId), token }));
    return dispatchPushTargets(targets, {
        title,
        body,
        data,
        sound,
        priority: "high",
    });
}

async function sendExpoPushToUsers({ userIds, title, body, data = {}, sound = "default", priority = "high", respectNotifications = true }) {
    if (!Array.isArray(userIds) || !userIds.length || !title || !body || shouldDisablePush()) {
        return { ok: true, sent: 0, tokens: 0, users: 0 };
    }

    const targets = await fetchPushTargetsByUserIds(userIds, { respectNotifications });
    if (!targets.length) {
        return { ok: true, sent: 0, tokens: 0, users: 0 };
    }

    return dispatchPushTargets(targets, {
        title,
        body,
        data,
        sound,
        priority,
    });
}

async function sendTapPushNotification({ ownerId, ownerSlug, visitorSlug, source }) {
    if (!ownerId || !visitorSlug) {
        return { ok: true, sent: 0, tokens: 0 };
    }

    return sendExpoPushToUser({
        userId: ownerId,
        title: "Новый тап",
        body: `${visitorSlug} открыл вашу визитку`,
        data: {
            type: "tap",
            ownerSlug: ownerSlug || null,
            visitorSlug,
            source: source || "direct",
        },
    });
}

module.exports = {
    sendExpoPushToUser,
    sendExpoPushToUsers,
    sendTapPushNotification,
};
