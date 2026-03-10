const { prisma } = require("../db/prisma");
const { getBraceletPrice, normalizePlan, resolveRequestedPlanForOrder, getPlanPurchaseType } = require("./pricing-settings");
const { buildOrderPaymentDraft } = require("./payment-flow");
const { logPaymentEvent } = require("./payment-events");
const { sendSlugApprovedToUser, sendSlugAwaitingPaymentToUser, sendSlugRejectedToUser } = require("./telegram");
const { recalculateAndRefreshPercentiles } = require("./unq-score");
const {
    getReferralV1Settings,
    resolveReferrerForUser,
    recordBonusLedger,
} = require("./referral-v1");
const { finalizeCampaignUsage, releaseCampaignUsage } = require("./referral-v2");

function makeTransitionError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function canTransitionOrderStatus(current, next) {
    const nowStatus = String(current || "").toLowerCase();
    const nextStatus = String(next || "").toLowerCase();

    if (nowStatus === nextStatus) return true;
    if (["approved", "rejected", "expired"].includes(nowStatus)) {
        return false;
    }
    return ["new", "contacted", "paid", "approved", "rejected", "expired"].includes(nextStatus);
}

async function applyOrderStatusTransition({
    orderId,
    status,
    adminNote = "",
    adminActor = "system",
    source = "admin_api",
}) {
    const nextStatus = String(status || "").trim().toLowerCase();
    const note = String(adminNote || "").trim();
    const actor = String(adminActor || "system").trim() || "system";
    const transitionSource = String(source || "admin_api").trim() || "admin_api";

    const braceletPriceValue = await getBraceletPrice();
    const order = await prisma.slugRequest.findUnique({
        where: { id: orderId },
        include: {
            user: {
                select: { id: true, telegramChatId: true, firstName: true },
            },
        },
    });

    if (!order) {
        throw makeTransitionError("ORDER_NOT_FOUND", "Order not found");
    }

    if (!canTransitionOrderStatus(order.status, nextStatus)) {
        throw makeTransitionError(
            "INVALID_STATUS_TRANSITION",
            `Cannot transition order status ${order.status} -> ${nextStatus}`,
        );
    }

    const totalOrderAmount = Number(order.slugPrice || 0) + Number(order.planPrice || 0) + (order.bracelet ? braceletPriceValue : 0);
    const paymentDraft = await buildOrderPaymentDraft({
        orderId: order.id,
        amount: totalOrderAmount,
    });
    const paymentAuditNote = `${paymentDraft.provider}:${paymentDraft.reference}`;

    const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.slugRequest.update({
            where: { id: order.id },
            data: {
                status: nextStatus,
                adminNote: note || null,
            },
            select: {
                id: true,
                status: true,
                userId: true,
                slug: true,
                adminNote: true,
            },
        });

        if (nextStatus === "approved") {
            const now = new Date();
            const referralSettings = await getReferralV1Settings();
            await tx.slug.upsert({
                where: { fullSlug: row.slug },
                create: {
                    letters: row.slug.slice(0, 3),
                    digits: row.slug.slice(3),
                    fullSlug: row.slug,
                    ownerId: row.userId,
                    status: "active",
                    approvedAt: now,
                    activatedAt: now,
                    requestedAt: order.createdAt,
                    pendingExpiresAt: null,
                    isPrimary: false,
                    price: order.slugPrice,
                },
                update: {
                    ownerId: row.userId,
                    status: "active",
                    approvedAt: now,
                    activatedAt: now,
                    pendingExpiresAt: null,
                    price: order.slugPrice,
                },
            });

            const existingUser = await tx.user.findUnique({
                where: { id: row.userId },
                select: {
                    plan: true,
                    planPurchasedAt: true,
                    planUpgradedAt: true,
                },
            });
            const currentPlan = normalizePlan(existingUser?.plan);
            const nextPlan = resolveRequestedPlanForOrder({
                currentPlan,
                requestedPlan: order.requestedPlan,
            });
            const userPatch = { plan: nextPlan };
            if (currentPlan === "none" && (nextPlan === "basic" || nextPlan === "premium")) {
                userPatch.planPurchasedAt = existingUser?.planPurchasedAt || now;
            }
            if (currentPlan === "basic" && nextPlan === "premium") {
                userPatch.planUpgradedAt = now;
                userPatch.planPurchasedAt = existingUser?.planPurchasedAt || now;
            }
            await tx.user.update({
                where: { id: row.userId },
                data: userPatch,
            });

            const hasPrimary = await tx.slug.count({
                where: {
                    ownerId: row.userId,
                    isPrimary: true,
                    status: { in: ["approved", "active", "paused", "private"] },
                },
            });
            if (!hasPrimary) {
                await tx.slug.update({
                    where: { fullSlug: row.slug },
                    data: { isPrimary: true },
                });
            }

            if (order.status !== "approved" && tx.purchase && typeof tx.purchase.create === "function") {
                const slugPurchase = await tx.purchase.create({
                    data: {
                        userId: row.userId,
                        type: "slug",
                        amount: Number(order.slugPrice || 0),
                        slug: row.slug,
                        purchasedAt: now,
                        approvedByAdmin: actor,
                        approvedAt: now,
                        note: `order:${row.id};payment:${paymentAuditNote}`,
                        refCode: order.refCode || null,
                        refSource: order.refSource || null,
                        refOffer: order.refOffer || null,
                        campaignId: order.campaignId || null,
                        promoCode: order.promoCode || null,
                        fraudVerdict: order.fraudVerdict || null,
                        fraudReason: order.fraudReason || null,
                        campaignSnapshot: order.campaignSnapshot || null,
                        inviteeDiscountApplied: Number(order.inviteeDiscountApplied || 0),
                        bonusSpent: Number(order.bonusSpent || 0),
                        discountCapApplied: Number(order.discountCapApplied || 0),
                    },
                    select: { id: true },
                });

                const planPurchaseType = getPlanPurchaseType({
                    currentPlan,
                    requestedPlan: nextPlan,
                });
                const planPrice = Number(order.planPrice || 0);
                if (planPurchaseType && planPrice > 0) {
                    await tx.purchase.create({
                        data: {
                            userId: row.userId,
                            type: planPurchaseType,
                            amount: planPrice,
                            slug: null,
                            purchasedAt: now,
                            approvedByAdmin: actor,
                            approvedAt: now,
                            note: `order:${row.id};payment:${paymentAuditNote}`,
                        },
                    });
                }

                if (order.bracelet) {
                    await tx.purchase.create({
                        data: {
                            userId: row.userId,
                            type: "bracelet",
                            amount: braceletPriceValue,
                            slug: row.slug,
                            purchasedAt: now,
                            approvedByAdmin: actor,
                            approvedAt: now,
                            note: `order:${row.id};payment:${paymentAuditNote}`,
                        },
                    });
                }

                const isFraudAllowed = String(order.fraudVerdict || "allow") === "allow";
                const rewardAmountFromSnapshot = Math.max(
                    0,
                    Math.round(Number(order?.campaignSnapshot?.referrerReward || referralSettings.referrerReward || 0)),
                );
                const shouldProcessReferral =
                    referralSettings.enabled ||
                    Number(order.inviteeDiscountApplied || 0) > 0 ||
                    Number(order.bonusSpent || 0) > 0 ||
                    Boolean(order.refCode);

                if (shouldProcessReferral && tx.referralConversion) {
                    const referrer = await resolveReferrerForUser({
                        userId: row.userId,
                        explicitRefCode: order.refCode || "",
                        sessionRefCode: "",
                        tx,
                    });

                    let conversion = null;
                    if (referrer?.referrerId) {
                        conversion = await tx.referralConversion.upsert({
                            where: { orderId: row.id },
                            create: {
                                referrerId: referrer.referrerId,
                                referredId: row.userId,
                                refCode: referrer.refCode || order.refCode || null,
                                refSource: order.refSource || null,
                                refOffer: order.refOffer || null,
                                status: isFraudAllowed ? "approved" : "pending",
                                rewardAmount: isFraudAllowed ? rewardAmountFromSnapshot : 0,
                                inviteeDiscountApplied: Number(order.inviteeDiscountApplied || 0),
                                bonusSpent: Number(order.bonusSpent || 0),
                                orderId: row.id,
                                purchaseId: slugPurchase.id,
                                approvedAt: isFraudAllowed ? now : null,
                            },
                            update: {
                                status: isFraudAllowed ? "approved" : "pending",
                                rewardAmount: isFraudAllowed ? rewardAmountFromSnapshot : 0,
                                inviteeDiscountApplied: Number(order.inviteeDiscountApplied || 0),
                                bonusSpent: Number(order.bonusSpent || 0),
                                purchaseId: slugPurchase.id,
                                approvedAt: isFraudAllowed ? now : null,
                            },
                            select: { id: true, referrerId: true },
                        });
                    }

                    const bonusSpent = Math.max(0, Number(order.bonusSpent || 0));
                    if (bonusSpent > 0) {
                        await recordBonusLedger({
                            tx,
                            userId: row.userId,
                            delta: -bonusSpent,
                            kind: "bonus_spend",
                            idempotencyKey: `order:${row.id}:bonus_spend`,
                            orderId: row.id,
                            purchaseId: slugPurchase.id,
                            conversionId: conversion?.id || null,
                            note: "Bonus spent for approved order",
                        });
                    }

                    if (isFraudAllowed && conversion?.referrerId && rewardAmountFromSnapshot > 0) {
                        await recordBonusLedger({
                            tx,
                            userId: conversion.referrerId,
                            delta: rewardAmountFromSnapshot,
                            kind: "referral_reward",
                            idempotencyKey: `refconv:${conversion.id}:reward`,
                            orderId: row.id,
                            purchaseId: slugPurchase.id,
                            conversionId: conversion.id,
                            note: `Referral reward for order ${row.id}`,
                        });
                    }
                }

                await finalizeCampaignUsage({
                    tx,
                    orderId: row.id,
                    purchaseId: slugPurchase.id,
                    amountSpent: Number(order.inviteeDiscountApplied || 0),
                });
            }
        }

        if (nextStatus === "rejected") {
            await tx.slug.upsert({
                where: { fullSlug: row.slug },
                create: {
                    letters: row.slug.slice(0, 3),
                    digits: row.slug.slice(3),
                    fullSlug: row.slug,
                    status: "free",
                    ownerId: null,
                    isPrimary: false,
                    pendingExpiresAt: null,
                    price: order.slugPrice,
                },
                update: {
                    ownerId: null,
                    status: "free",
                    isPrimary: false,
                    pauseMessage: null,
                    pendingExpiresAt: null,
                    approvedAt: null,
                    requestedAt: null,
                    activatedAt: null,
                },
            });
            await releaseCampaignUsage({
                tx,
                orderId: row.id,
            });
        }

        const userAfter =
            nextStatus === "approved"
                ? await tx.user.findUnique({
                    where: { id: row.userId },
                    select: { plan: true },
                })
                : null;
        return { ...row, approvedPlan: userAfter?.plan || null };
    });

    await logPaymentEvent({
        orderId: order.id,
        userId: order.userId,
        status: updated.status,
        provider: paymentDraft.provider,
        reference: paymentDraft.reference,
        amount: paymentDraft.amount,
        actor,
        source: transitionSource,
        note: updated.adminNote || "",
    });

    if (nextStatus === "approved") {
        try {
            await sendSlugApprovedToUser({
                telegramId: order.user?.telegramChatId || "",
                slug: updated.slug,
                plan: updated.approvedPlan || order.requestedPlan,
                hasBracelet: Boolean(order.bracelet),
            });
        } catch (error) {
            console.error("[express-app] failed to send approval notification", error);
        }
    }

    if (nextStatus === "paid") {
        try {
            await sendSlugAwaitingPaymentToUser({
                telegramId: order.user?.telegramChatId || "",
                slug: updated.slug,
            });
        } catch (error) {
            console.error("[express-app] failed to send payment-pending notification", error);
        }
    }

    if (nextStatus === "approved" || nextStatus === "rejected") {
        try {
            await recalculateAndRefreshPercentiles(updated.userId);
        } catch (error) {
            console.error("[express-app] failed to recalculate score after order status change", error);
        }
    }

    if (nextStatus === "rejected") {
        try {
            await sendSlugRejectedToUser({
                telegramId: order.user?.telegramChatId || "",
                slug: updated.slug,
                adminNote: updated.adminNote,
            });
        } catch (error) {
            console.error("[express-app] failed to send rejection notification", error);
        }
    }

    return { updated, order, payment: paymentDraft };
}

module.exports = {
    applyOrderStatusTransition,
};
