const { prisma } = require("../db/prisma");
const { Prisma } = require("@prisma/client");

/**
 * Check if payment_events table exists
 */
function isPaymentEventsStorageError(error) {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  return code === "42P01" || code === "P2021" || message.includes("payment_events");
}

/**
 * Get aggregated payment statistics for admin dashboard
 */
async function getPaymentStatistics({ period = "day" } = {}) {
  try {
    const now = new Date();
    let startDate;

    switch (period) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "all":
        startDate = new Date(0);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Order statistics by status
    const orderStats = await prisma.slugRequest.groupBy({
      by: ["status"],
      where: {
        createdAt: { gte: startDate },
      },
      _count: true,
      _sum: {
        slugPrice: true,
        planPrice: true,
      },
    });

    // Payment events statistics
    let eventStats = [];
    try {
      eventStats = await prisma.$queryRaw`
        SELECT 
          status,
          COUNT(*)::int as count,
          SUM(amount)::int as total_amount,
          COUNT(DISTINCT order_id)::int as unique_orders
        FROM payment_events
        WHERE created_at >= ${startDate}
        GROUP BY status
      `;
    } catch (error) {
      if (!isPaymentEventsStorageError(error)) {
        throw error;
      }
    }

    // Revenue by provider
    let providerRevenue = [];
    try {
      providerRevenue = await prisma.$queryRaw`
        SELECT 
          provider,
          COUNT(*)::int as count,
          SUM(amount)::int as total_amount
        FROM payment_events
        WHERE created_at >= ${startDate}
          AND status = 'approved'
        GROUP BY provider
      `;
    } catch (error) {
      if (!isPaymentEventsStorageError(error)) {
        throw error;
      }
    }

    // Active slugs and users
    const totalSlugsSold = await prisma.slug.count({
      where: {
        status: { in: ["approved", "active"] },
      },
    });

    const totalUsers = await prisma.user.count({
      where: {
        plan: { not: "none" },
      },
    });

    return {
      period,
      startDate,
      endDate: now,
      orders: {
        byStatus: orderStats.map((s) => ({
          status: s.status,
          count: s._count,
          totalAmount: (s._sum.slugPrice || 0) + (s._sum.planPrice || 0),
        })),
        total: orderStats.reduce((sum, s) => sum + s._count, 0),
        totalRevenue: orderStats.reduce((sum, s) => sum + (s._sum.slugPrice || 0) + (s._sum.planPrice || 0), 0),
      },
      events: {
        byStatus: eventStats.map((e) => ({
          status: e.status,
          count: e.count,
          totalAmount: e.total_amount || 0,
          uniqueOrders: e.unique_orders || 0,
        })),
      },
      revenue: {
        byProvider: providerRevenue.map((p) => ({
          provider: p.provider,
          count: p.count,
          totalAmount: p.total_amount || 0,
        })),
        total: providerRevenue.reduce((sum, p) => sum + (p.total_amount || 0), 0),
      },
      platform: {
        totalSlugsSold,
        totalUsers,
      },
    };
  } catch (error) {
    console.error("Error getting payment statistics:", error);
    throw error;
  }
}

/**
 * Get payment alerts for admin dashboard
 */
async function getPaymentAlerts() {
  const alerts = [];

  try {
    // Alert 1: Pending orders older than 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oldPendingOrders = await prisma.slugRequest.findMany({
      where: {
        status: "new",
        createdAt: { lt: oneDayAgo },
      },
      select: {
        id: true,
        slug: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
      take: 10,
    });

    if (oldPendingOrders.length > 0) {
      alerts.push({
        type: "pending_orders_old",
        severity: "warning",
        message: `${oldPendingOrders.length} заказов в статусе "new" более 24 часов`,
        count: oldPendingOrders.length,
        data: oldPendingOrders.map((o) => ({
          orderId: o.id,
          slug: o.slug,
          age: Math.floor((Date.now() - o.createdAt.getTime()) / (1000 * 60 * 60)),
          userName: o.user?.fullName || "Unknown",
          userEmail: o.user?.email,
        })),
      });
    }

    // Alert 2: Orders marked as "paid" but not "approved" for > 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const paidNotApproved = await prisma.slugRequest.findMany({
      where: {
        status: "paid",
        updatedAt: { lt: twoHoursAgo },
      },
      select: {
        id: true,
        slug: true,
        updatedAt: true,
        slugPrice: true,
        planPrice: true,
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: 10,
    });

    if (paidNotApproved.length > 0) {
      alerts.push({
        type: "paid_not_approved",
        severity: "critical",
        message: `${paidNotApproved.length} заказов в статусе "paid" не одобрены более 2 часов`,
        count: paidNotApproved.length,
        data: paidNotApproved.map((o) => ({
          orderId: o.id,
          slug: o.slug,
          amount: (o.slugPrice || 0) + (o.planPrice || 0),
          age: Math.floor((Date.now() - o.updatedAt.getTime()) / (1000 * 60 * 60)),
          userName: o.user?.fullName || "Unknown",
        })),
      });
    }

    // Alert 3: Orders marked as "contacted" for > 48 hours
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const contactedStalled = await prisma.slugRequest.findMany({
      where: {
        status: "contacted",
        updatedAt: { lt: twoDaysAgo },
      },
      select: {
        id: true,
        slug: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { updatedAt: "asc" },
      take: 10,
    });

    if (contactedStalled.length > 0) {
      alerts.push({
        type: "contacted_stalled",
        severity: "info",
        message: `${contactedStalled.length} заказов в статусе "contacted" более 48 часов`,
        count: contactedStalled.length,
        data: contactedStalled.map((o) => ({
          orderId: o.id,
          slug: o.slug,
          age: Math.floor((Date.now() - o.updatedAt.getTime()) / (1000 * 60 * 60)),
          userName: o.user?.fullName || "Unknown",
        })),
      });
    }

    // Alert 4: Check for payment events discrepancies
    try {
      const discrepancies = await prisma.$queryRaw`
        SELECT 
          sr.id as order_id,
          sr.slug,
          sr.status,
          (sr.slug_price + sr.plan_price)::int as total_amount,
          COUNT(pe.id)::int as event_count,
          ARRAY_AGG(DISTINCT pe.status) as event_statuses
        FROM slug_requests sr
        LEFT JOIN payment_events pe ON pe.order_id = sr.id
        WHERE sr.status IN ('paid', 'approved')
          AND sr.created_at > NOW() - INTERVAL '7 days'
        GROUP BY sr.id, sr.slug, sr.status, sr.slug_price, sr.plan_price
        HAVING COUNT(pe.id) = 0 OR NOT(ARRAY['approved']::text[] <@ ARRAY_AGG(DISTINCT pe.status))
        LIMIT 10
      `;

      if (discrepancies.length > 0) {
        alerts.push({
          type: "payment_event_mismatch",
          severity: "warning",
          message: `${discrepancies.length} заказов без payment events или с несоответствиями`,
          count: discrepancies.length,
          data: discrepancies.map((d) => ({
            orderId: d.order_id,
            slug: d.slug,
            status: d.status,
            amount: d.total_amount,
            eventCount: d.event_count,
            eventStatuses: d.event_statuses,
          })),
        });
      }
    } catch (error) {
      if (!isPaymentEventsStorageError(error)) {
        throw error;
      }
    }

    return alerts;
  } catch (error) {
    console.error("Error getting payment alerts:", error);
    throw error;
  }
}

/**
 * Get detailed conversion funnel metrics
 */
async function getConversionFunnel({ period = "week" } = {}) {
  try {
    const now = new Date();
    let startDate;

    switch (period) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        startDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate());
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    }

    // Count orders by each status
    const newOrders = await prisma.slugRequest.count({
      where: { status: "new", createdAt: { gte: startDate } },
    });

    const contactedOrders = await prisma.slugRequest.count({
      where: { status: "contacted", createdAt: { gte: startDate } },
    });

    const paidOrders = await prisma.slugRequest.count({
      where: { status: "paid", createdAt: { gte: startDate } },
    });

    const approvedOrders = await prisma.slugRequest.count({
      where: { status: "approved", createdAt: { gte: startDate } },
    });

    const rejectedOrders = await prisma.slugRequest.count({
      where: { status: "rejected", createdAt: { gte: startDate } },
    });

    const expiredOrders = await prisma.slugRequest.count({
      where: { status: "expired", createdAt: { gte: startDate } },
    });

    const totalOrders = newOrders + contactedOrders + paidOrders + approvedOrders + rejectedOrders + expiredOrders;

    return {
      period,
      startDate,
      endDate: now,
      funnel: [
        {
          stage: "new",
          count: newOrders,
          percentage: totalOrders > 0 ? ((newOrders / totalOrders) * 100).toFixed(1) : 0,
        },
        {
          stage: "contacted",
          count: contactedOrders,
          percentage: totalOrders > 0 ? ((contactedOrders / totalOrders) * 100).toFixed(1) : 0,
          conversionFromPrevious:
            newOrders > 0 ? ((contactedOrders / newOrders) * 100).toFixed(1) : 0,
        },
        {
          stage: "paid",
          count: paidOrders,
          percentage: totalOrders > 0 ? ((paidOrders / totalOrders) * 100).toFixed(1) : 0,
          conversionFromPrevious:
            contactedOrders > 0 ? ((paidOrders / contactedOrders) * 100).toFixed(1) : 0,
        },
        {
          stage: "approved",
          count: approvedOrders,
          percentage: totalOrders > 0 ? ((approvedOrders / totalOrders) * 100).toFixed(1) : 0,
          conversionFromPrevious: paidOrders > 0 ? ((approvedOrders / paidOrders) * 100).toFixed(1) : 0,
        },
      ],
      dropoff: [
        {
          stage: "rejected",
          count: rejectedOrders,
          percentage: totalOrders > 0 ? ((rejectedOrders / totalOrders) * 100).toFixed(1) : 0,
        },
        {
          stage: "expired",
          count: expiredOrders,
          percentage: totalOrders > 0 ? ((expiredOrders / totalOrders) * 100).toFixed(1) : 0,
        },
      ],
      totalOrders,
      overallConversionRate:
        newOrders > 0 ? ((approvedOrders / newOrders) * 100).toFixed(1) : 0,
    };
  } catch (error) {
    console.error("Error getting conversion funnel:", error);
    throw error;
  }
}

module.exports = {
  getPaymentStatistics,
  getPaymentAlerts,
  getConversionFunnel,
  isPaymentEventsStorageError,
};
