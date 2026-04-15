const express = require("express");

const { env } = require("../../config/env");
const { asyncHandler } = require("../../middleware/async");
const { prisma } = require("../../db/prisma");
const { applyOrderStatusTransition } = require("../../services/order-status-transition");
const { logPaymentEvent } = require("../../services/payment-events");
const { safeSecretEqual, normalizeAuthorizationSecret } = require("../../utils/secrets");

const router = express.Router();

function pickString(...values) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }
    return "";
}

function extractPaymeWebhookData(payload) {
    const body = payload && typeof payload === "object" ? payload : {};
    const params = body.params && typeof body.params === "object" ? body.params : {};
    const account = params.account && typeof params.account === "object" ? params.account : {};
    const result = body.result && typeof body.result === "object" ? body.result : {};

    const orderId = pickString(
        body.orderId,
        body.order_id,
        body.slugRequestId,
        params.orderId,
        params.order_id,
        params.slugRequestId,
        account.orderId,
        account.order_id,
        account.slugRequestId,
    );

    const transactionId = pickString(
        body.transactionId,
        body.transaction_id,
        body.id,
        result.transaction,
        result.transaction_id,
        params.id,
    );

    const status = String(body.status || params.status || result.status || "")
        .trim()
        .toLowerCase();
    const method = String(body.method || "").trim();
    const state = Number(result.state ?? params.state ?? body.state);
    const amount = Number(body.amount ?? params.amount ?? result.amount ?? 0);

    const isPaid =
        ["paid", "success", "succeeded", "completed", "performtransaction"].includes(status) ||
        method === "PerformTransaction" ||
        state === 2;

    return {
        orderId,
        transactionId,
        status,
        method,
        state,
        amount: Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0,
        isPaid,
    };
}

function resolvePaymeWebhookAuthorization(req) {
    const configuredSecret = String(env.PAYME_WEBHOOK_SECRET || "").trim();
    if (!configuredSecret) {
        return {
            authorized: env.NODE_ENV !== "production",
            misconfigured: env.NODE_ENV === "production",
        };
    }

    const headerSignature = pickString(req.get("x-payme-signature"));
    const headerAuth = normalizeAuthorizationSecret(req.get("authorization"));
    const candidates = [headerSignature, headerAuth].filter(Boolean);
    return {
        authorized: candidates.some((candidate) => safeSecretEqual(candidate, configuredSecret)),
        misconfigured: false,
    };
}

async function handlePaymeWebhook(req, res) {
    const authState = resolvePaymeWebhookAuthorization(req);
    if (!authState.authorized) {
        console.warn("[payme-webhook] rejected request", {
            misconfiguredSecret: authState.misconfigured,
            hasHeaderSignature: Boolean(req.get("x-payme-signature")),
            hasAuthorization: Boolean(req.get("authorization")),
        });
        res.status(authState.misconfigured ? 503 : 401).json({ ok: false, error: "Unauthorized webhook" });
        return;
    }

    const parsed = extractPaymeWebhookData(req.body);
    if (!parsed.orderId) {
        console.warn("[payme-webhook] order id is missing", {
            method: parsed.method,
            status: parsed.status,
        });
        res.json({ ok: true, skipped: "ORDER_ID_MISSING" });
        return;
    }

    const order = await prisma.slugRequest.findUnique({
        where: { id: parsed.orderId },
        select: {
            id: true,
            userId: true,
            slugPrice: true,
            planPrice: true,
            bracelet: true,
            status: true,
        },
    });

    if (!order) {
        console.warn("[payme-webhook] order not found", { orderId: parsed.orderId });
        res.json({ ok: true, skipped: "ORDER_NOT_FOUND" });
        return;
    }

    if (!parsed.isPaid) {
        await logPaymentEvent({
            orderId: order.id,
            userId: order.userId,
            status: order.status,
            provider: "payme",
            reference: parsed.transactionId || "",
            amount: parsed.amount,
            actor: "system:payme-webhook",
            source: "payme_webhook",
            note: `Ignored webhook event: method=${parsed.method || "unknown"}; status=${parsed.status || "unknown"}; state=${Number.isFinite(parsed.state) ? parsed.state : "n/a"}`,
        }).catch((error) => {
            console.error("[payme-webhook] failed to log ignored event", error);
        });

        res.json({ ok: true, skipped: "NOT_PAID_EVENT" });
        return;
    }

    const totalAmount = Number(order.slugPrice || 0) + Number(order.planPrice || 0);
    await logPaymentEvent({
        orderId: order.id,
        userId: order.userId,
        status: "paid",
        provider: "payme",
        reference: parsed.transactionId || "",
        amount: parsed.amount || totalAmount,
        actor: "system:payme-webhook",
        source: "payme_webhook",
        note: `Payme webhook received: method=${parsed.method || "unknown"}; state=${Number.isFinite(parsed.state) ? parsed.state : "n/a"}`,
    }).catch((error) => {
        console.error("[payme-webhook] failed to log paid event", error);
    });

    if (["approved", "rejected", "expired"].includes(String(order.status || "").toLowerCase())) {
        res.json({ ok: true, skipped: `ORDER_STATUS_${String(order.status || "").toUpperCase()}` });
        return;
    }

    try {
        await applyOrderStatusTransition({
            orderId: order.id,
            status: "paid",
            adminNote: `Оплата подтверждена автоматически через Payme (${parsed.transactionId || "no-tx"})`,
            adminActor: "payme:webhook",
            source: "payme_webhook",
        });
    } catch (error) {
        if (error?.code !== "INVALID_STATUS_TRANSITION") {
            throw error;
        }
    }

    res.json({ ok: true });
}

router.post("/payme/webhook", asyncHandler(handlePaymeWebhook));

module.exports = {
    paymentsApiRouter: router,
};
