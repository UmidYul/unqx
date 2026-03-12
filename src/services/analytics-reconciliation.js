const { prisma } = require("../db/prisma");

async function reconcileAnalyticsViewCounters() {
  const updatedRows = await prisma.$queryRaw`
    WITH recalculated AS (
      SELECT
        s.full_slug,
        COALESCE(v.views_count, 0)::int AS views_count
      FROM slugs s
      LEFT JOIN (
        SELECT slug, COUNT(*)::int AS views_count
        FROM analytics_views
        GROUP BY slug
      ) v ON v.slug = s.full_slug
    )
    UPDATE slugs s
    SET analytics_views_count = r.views_count
    FROM recalculated r
    WHERE s.full_slug = r.full_slug
      AND COALESCE(s.analytics_views_count, 0) <> r.views_count
    RETURNING s.full_slug AS slug
  `;

  return Array.isArray(updatedRows) ? updatedRows.length : 0;
}

module.exports = {
  reconcileAnalyticsViewCounters,
};
