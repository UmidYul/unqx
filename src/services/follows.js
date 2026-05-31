const { prisma } = require("../db/prisma");
const { isPublicProfileVisible } = require("./subscription");
const { sendFollowPushNotification } = require("./push");
const {
  PUBLIC_HANDLE_SLUG_STATUSES,
  getActivePublicHandle,
  findPublicHandleByValue,
  getFreeProfileUserSelect,
} = require("./public-handle");

const FOLLOW_LIST_PAGE_SIZE = 20;
const FOLLOW_PREVIEW_LIMIT = 4;
const FOLLOW_LINKABLE_SLUG_STATUSES = PUBLIC_HANDLE_SLUG_STATUSES;
const FOLLOW_PUBLIC_BATCH_SIZE = 60;

function isMissingModelTable(error, modelName) {
  return (
    Boolean(error) &&
    error.code === "P2021" &&
    (!modelName || String(error?.meta?.modelName || "") === modelName)
  );
}

function isMissingModelColumn(error, modelName) {
  if (!error || error.code !== "P2022") {
    return false;
  }

  if (!modelName) {
    return true;
  }

  const targetModel = String(error?.meta?.modelName || "");
  if (!targetModel) {
    return true;
  }

  return targetModel === modelName;
}

function getModelDelegate(modelName) {
  if (!modelName || typeof modelName !== "string") {
    return null;
  }
  const key = `${modelName.slice(0, 1).toLowerCase()}${modelName.slice(1)}`;
  const delegate = prisma[key];
  return delegate && typeof delegate === "object" ? delegate : null;
}

function isMissingModelDelegateError(error) {
  if (!error || error.name !== "TypeError") {
    return false;
  }
  const message = String(error.message || "");
  return (
    message.includes("Cannot read properties of undefined") &&
    (message.includes("findMany") ||
      message.includes("findFirst") ||
      message.includes("count") ||
      message.includes("create") ||
      message.includes("deleteMany") ||
      message.includes("upsert"))
  );
}

function isMissingRawTableError(error, tableName = "") {
  if (!error || typeof error !== "object") return false;
  const code = String(error.code || "");
  const message = String(error.message || "").toLowerCase();
  const table = String(tableName || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "P2010" ||
    (table ? message.includes(table) : false)
  );
}

function isFollowStorageMissing(error) {
  return (
    isMissingModelTable(error, "UserFollow") ||
    isMissingModelColumn(error, "UserFollow") ||
    isMissingModelDelegateError(error)
  );
}

async function withMissingFollowFallback(fallbackValue, callback) {
  if (!getModelDelegate("UserFollow")) {
    return fallbackValue;
  }
  try {
    return await callback();
  } catch (error) {
    if (isFollowStorageMissing(error)) {
      return fallbackValue;
    }
    throw error;
  }
}

function normalizeFollowListType(value) {
  return String(value || "").trim().toLowerCase() === "followers" ? "followers" : "following";
}

function normalizeFollowScope(value) {
  return String(value || "").trim().toLowerCase() === "public" ? "public" : "owner";
}

function resolveFollowPage(rawPage) {
  const parsed = Number(rawPage);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(1, Math.round(parsed));
}

function resolveFollowPageSize(rawPageSize, fallback = FOLLOW_LIST_PAGE_SIZE, max = 50) {
  const parsed = Number(rawPageSize);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.round(parsed)));
}

function getFollowUserName(user) {
  const cardName = String(user?.profileCard?.name || "").trim();
  if (cardName) return cardName;
  const displayName = String(user?.displayName || "").trim();
  if (displayName) return displayName;
  const firstName = String(user?.firstName || "").trim();
  if (firstName) return firstName;
  return "UNQX User";
}

function getFollowUserInitials(name) {
  const initials = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] ? part[0].toUpperCase() : ""))
    .join("");
  return initials || "UN";
}

function getFollowUserSelect() {
  return {
    id: true,
    status: true,
    plan: true,
    subscriptionStartedAt: true,
    subscriptionExpiresAt: true,
    displayName: true,
    firstName: true,
    lastName: true,
    username: true,
    login: true,
    isVerified: true,
    verifiedCompany: true,
    ...getFreeProfileUserSelect(),
    profileCard: {
      select: {
        name: true,
        role: true,
        avatarUrl: true,
      },
    },
    slugs: {
      where: {
        status: {
          in: FOLLOW_LINKABLE_SLUG_STATUSES,
        },
      },
      orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
      take: 1,
      select: {
        fullSlug: true,
      },
    },
  };
}

function getPublicProfileHrefFromUser(user) {
  const publicHandle = getActivePublicHandle(user);
  if (!publicHandle?.value || !user || user.status !== "active" || !isPublicProfileVisible(user)) {
    return null;
  }
  return publicHandle.href;
}

function mapFollowUserItem(user, options = {}) {
  if (!user) return null;
  const viewerUserId = String(options.viewerUserId || "").trim();
  const userId = String(user.id || "").trim();
  if (!userId) return null;

  const name = getFollowUserName(user);
  const publicHandle = getActivePublicHandle(user);
  const primarySlug = String(publicHandle?.value || "").trim().toUpperCase() || null;
  const isPubliclyReachable = Boolean(getPublicProfileHrefFromUser(user));

  const viewerFollowingSet = options.viewerFollowingSet instanceof Set ? options.viewerFollowingSet : new Set();
  return {
    userId,
    name,
    initials: getFollowUserInitials(name),
    avatarUrl: String(user?.profileCard?.avatarUrl || "").trim() || null,
    primarySlug,
    role: String(user?.profileCard?.role || user?.verifiedCompany || "").trim(),
    verified: Boolean(user?.isVerified),
    isFollowing: Boolean(viewerUserId) && viewerUserId !== userId && viewerFollowingSet.has(userId),
    canFollow: isPubliclyReachable && userId !== viewerUserId,
    requiresAuth: !viewerUserId,
    isPubliclyReachable,
    profileHref: isPubliclyReachable ? getPublicProfileHrefFromUser(user) : null,
  };
}

function mapFollowRowItem(row, options = {}) {
  if (!row || typeof row !== "object") return null;
  const relatedUser =
    row.follower && typeof row.follower === "object"
      ? row.follower
      : row.followee && typeof row.followee === "object"
        ? row.followee
        : null;
  const mappedUser = mapFollowUserItem(relatedUser, options);
  if (!mappedUser) {
    return null;
  }
  return {
    ...mappedUser,
    followedAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

async function syncLegacyUserContactSubscription({ followerUserId, slug, followeeId, subscribed }) {
  const normalizedFollowerUserId = String(followerUserId || "").trim();
  const normalizedFolloweeId = String(followeeId || "").trim();
  const normalizedSlug = String(slug || "").trim().toUpperCase();
  if (!normalizedFollowerUserId || !normalizedSlug) {
    return;
  }

  try {
    await prisma.$executeRaw`
      INSERT INTO user_contacts (
        owner_id,
        contact_slug,
        contact_user_id,
        saved,
        subscribed,
        first_tap_at,
        last_tap_at,
        tap_count
      )
      VALUES (
        ${normalizedFollowerUserId},
        ${normalizedSlug},
        ${normalizedFolloweeId || null},
        false,
        ${Boolean(subscribed)},
        now(),
        now(),
        0
      )
      ON CONFLICT (owner_id, contact_slug)
      DO UPDATE SET
        contact_user_id = COALESCE(EXCLUDED.contact_user_id, user_contacts.contact_user_id),
        subscribed = ${Boolean(subscribed)},
        last_tap_at = now()
    `;
  } catch (error) {
    if (!isMissingRawTableError(error, "user_contacts")) {
      throw error;
    }
  }
}

async function createFollowNotification({ followeeId, follower }) {
  const normalizedFolloweeId = String(followeeId || "").trim();
  const followerId = String(follower?.id || "").trim();
  if (!normalizedFolloweeId || !followerId || normalizedFolloweeId === followerId) {
    return;
  }

  const followerName = getFollowUserName(follower);
  const followerHandle = getActivePublicHandle(follower);
  const followerSlug = String(followerHandle?.value || "").trim().toUpperCase() || null;
  const profileHref = followerHandle?.href || null;
  try {
    await prisma.$executeRaw`
      INSERT INTO notifications (
        user_id,
        type,
        title,
        body,
        data
      )
      VALUES (
        ${normalizedFolloweeId},
        'follow',
        'Новый подписчик',
        ${`${followerName} подписался на вас`},
        ${JSON.stringify({
          type: "follow",
          followerUserId: followerId,
          followerSlug,
          profileHref,
          followerName,
        })}
      )
    `;
  } catch (error) {
    if (!isMissingRawTableError(error, "notifications")) {
      throw error;
    }
  }

  void sendFollowPushNotification({
    followeeId: normalizedFolloweeId,
    followerName,
    followerSlug,
  }).catch((pushError) => {
    console.error("[push] failed to send follow notification", {
      followeeId: normalizedFolloweeId,
      followerId,
      message: pushError?.message || String(pushError),
    });
  });
}

async function findPublicFollowTargetBySlug(slug) {
  const normalizedSlug = String(slug || "").trim().toUpperCase();
  if (!normalizedSlug) {
    return null;
  }

  let row = null;
  try {
    row = await findPublicHandleByValue(normalizedSlug, {
      includeProfileCard: true,
      includeSlugs: true,
    });
  } catch (error) {
    if (!isMissingModelTable(error, "Slug") && !isMissingModelColumn(error, "Slug") && !isMissingModelDelegateError(error)) {
      throw error;
    }
  }

  if (
    !row?.ownerId ||
    !FOLLOW_LINKABLE_SLUG_STATUSES.includes(String(row.status || "").trim().toLowerCase()) ||
    !row.owner ||
    row.owner.status !== "active" ||
    !isPublicProfileVisible(row.owner)
  ) {
    return null;
  }

  return {
    slug: normalizedSlug,
    ownerId: String(row.ownerId || "").trim(),
    owner: row.owner,
  };
}

function assertFollowStorageWritable() {
  if (getModelDelegate("UserFollow")) {
    return;
  }
  const error = new Error("Follow storage unavailable");
  error.code = "FOLLOW_STORAGE_UNAVAILABLE";
  throw error;
}

async function getViewerFollowLookup(followerUserId, followeeUserIds = []) {
  const normalizedFollowerUserId = String(followerUserId || "").trim();
  const normalizedFolloweeIds = Array.isArray(followeeUserIds)
    ? Array.from(
      new Set(
        followeeUserIds
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    )
    : [];

  if (!normalizedFollowerUserId || !normalizedFolloweeIds.length) {
    return new Set();
  }

  const rows = await withMissingFollowFallback([], () =>
    prisma.userFollow.findMany({
      where: {
        followerId: normalizedFollowerUserId,
        followeeId: {
          in: normalizedFolloweeIds,
        },
      },
      select: {
        followeeId: true,
      },
    }),
  );

  return new Set(rows.map((row) => String(row.followeeId || "").trim()).filter(Boolean));
}

async function getUnreadFollowNotificationsCount(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return 0;
  }

  try {
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE user_id = ${normalizedUserId}
        AND type = 'follow'
        AND read = false
    `;
    return Math.max(0, Number(rows?.[0]?.count || 0));
  } catch (error) {
    if (isMissingRawTableError(error, "notifications")) {
      return 0;
    }
    throw error;
  }
}

async function markFollowNotificationsRead(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return { ok: true, unreadFollowersCount: 0 };
  }

  try {
    await prisma.$executeRaw`
      UPDATE notifications
      SET read = true
      WHERE user_id = ${normalizedUserId}
        AND type = 'follow'
        AND read = false
    `;
  } catch (error) {
    if (!isMissingRawTableError(error, "notifications")) {
      throw error;
    }
  }

  return { ok: true, unreadFollowersCount: 0 };
}

async function getFollowCounts(ownerId) {
  const normalizedOwnerId = String(ownerId || "").trim();
  if (!normalizedOwnerId) {
    return {
      followersCount: 0,
      followingCount: 0,
    };
  }

  const [followersCount, followingCount] = await withMissingFollowFallback([0, 0], () =>
    Promise.all([
      prisma.userFollow.count({
        where: { followeeId: normalizedOwnerId },
      }),
      prisma.userFollow.count({
        where: { followerId: normalizedOwnerId },
      }),
    ]),
  );

  return {
    followersCount: Math.max(0, Number(followersCount || 0)),
    followingCount: Math.max(0, Number(followingCount || 0)),
  };
}

async function listFollowItemsByOwner({
  ownerId,
  type = "following",
  viewerUserId = "",
  page = 1,
  pageSize = FOLLOW_LIST_PAGE_SIZE,
  scope = "owner",
} = {}) {
  const normalizedOwnerId = String(ownerId || "").trim();
  const normalizedViewerUserId = String(viewerUserId || "").trim();
  const normalizedType = normalizeFollowListType(type);
  const normalizedPage = resolveFollowPage(page);
  const normalizedPageSize = resolveFollowPageSize(pageSize, FOLLOW_LIST_PAGE_SIZE, 50);
  const normalizedScope = normalizeFollowScope(scope);
  if (!normalizedOwnerId) {
    return {
      items: [],
      pagination: { page: normalizedPage, pageSize: normalizedPageSize, total: 0, hasMore: false },
    };
  }

  const where =
    normalizedType === "followers"
      ? { followeeId: normalizedOwnerId }
      : { followerId: normalizedOwnerId };
  const relationKey = normalizedType === "followers" ? "follower" : "followee";

  if (normalizedScope === "public") {
    let offset = 0;
    let visibleSeen = 0;
    const visibleTargetStart = (normalizedPage - 1) * normalizedPageSize;
    const collected = [];
    let batchRows = [];

    do {
      batchRows = await withMissingFollowFallback([], () =>
        prisma.userFollow.findMany({
          where,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip: offset,
          take: FOLLOW_PUBLIC_BATCH_SIZE,
          select: {
            id: true,
            createdAt: true,
            [relationKey]: {
              select: getFollowUserSelect(),
            },
          },
        }),
      );

      offset += batchRows.length;
      const userIdsForLookup = batchRows
        .map((row) => String(row?.[relationKey]?.id || "").trim())
        .filter(Boolean);
      const viewerFollowingSet = await getViewerFollowLookup(normalizedViewerUserId, userIdsForLookup);

      for (const row of batchRows) {
        const mapped = mapFollowRowItem(row, {
          viewerUserId: normalizedViewerUserId,
          viewerFollowingSet,
          scope: normalizedScope,
        });
        if (!mapped) {
          continue;
        }
        if (visibleSeen >= visibleTargetStart && collected.length < normalizedPageSize) {
          collected.push(mapped);
        }
        visibleSeen += 1;
      }
    } while (batchRows.length === FOLLOW_PUBLIC_BATCH_SIZE);

    return {
      items: collected,
      pagination: {
        page: normalizedPage,
        pageSize: normalizedPageSize,
        total: visibleSeen,
        hasMore: normalizedPage * normalizedPageSize < visibleSeen,
      },
    };
  }

  const [rows, total] = await withMissingFollowFallback([[], 0], () =>
    Promise.all([
      prisma.userFollow.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (normalizedPage - 1) * normalizedPageSize,
        take: normalizedPageSize,
        select: {
          id: true,
          createdAt: true,
          [relationKey]: {
            select: getFollowUserSelect(),
          },
        },
      }),
      prisma.userFollow.count({ where }),
    ]),
  );

  const userIdsForLookup = rows
    .map((row) => String(row?.[relationKey]?.id || "").trim())
    .filter(Boolean);
  const viewerFollowingSet = await getViewerFollowLookup(normalizedViewerUserId, userIdsForLookup);
  const items = rows
    .map((row) =>
      mapFollowRowItem(row, {
        viewerUserId: normalizedViewerUserId,
        viewerFollowingSet,
        scope: normalizedScope,
      }),
    )
    .filter(Boolean);

  return {
    items,
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total: Math.max(0, Number(total || 0)),
      hasMore: normalizedPage * normalizedPageSize < Number(total || 0),
    },
  };
}

async function getFollowSummaryForOwner({ ownerId, viewerUserId = "", scope = "owner" } = {}) {
  const normalizedOwnerId = String(ownerId || "").trim();
  const normalizedViewerUserId = String(viewerUserId || "").trim();
  const normalizedScope = normalizeFollowScope(scope);
  if (!normalizedOwnerId) {
    return {
      counts: { followers: 0, following: 0 },
      viewer: { isFollowing: false, canFollow: false, requiresAuth: true },
      unreadFollowersCount: 0,
      previews: { following: [] },
    };
  }

  let followersCount = 0;
  let followingCount = 0;
  let followingPreviewPayload = { items: [] };
  let viewerFollowingSet = new Set();
  let unreadFollowersCount = 0;

  if (normalizedScope === "public") {
    const [counts, nextViewerFollowingSet, nextFollowingPreviewPayload, nextUnreadFollowersCount] = await Promise.all([
      getFollowCounts(normalizedOwnerId),
      getViewerFollowLookup(normalizedViewerUserId, [normalizedOwnerId]),
      listFollowItemsByOwner({
        ownerId: normalizedOwnerId,
        type: "following",
        viewerUserId: normalizedViewerUserId,
        page: 1,
        pageSize: FOLLOW_PREVIEW_LIMIT,
        scope: normalizedScope,
      }),
      normalizedViewerUserId === normalizedOwnerId ? getUnreadFollowNotificationsCount(normalizedOwnerId) : Promise.resolve(0),
    ]);
    followersCount = Math.max(0, Number(counts?.followersCount || 0));
    followingCount = Math.max(0, Number(counts?.followingCount || 0));
    viewerFollowingSet = nextViewerFollowingSet;
    followingPreviewPayload = nextFollowingPreviewPayload;
    unreadFollowersCount = nextUnreadFollowersCount;
  } else {
    const [counts, nextViewerFollowingSet, nextFollowingPreviewPayload, nextUnreadFollowersCount] = await Promise.all([
      getFollowCounts(normalizedOwnerId),
      getViewerFollowLookup(normalizedViewerUserId, [normalizedOwnerId]),
      listFollowItemsByOwner({
        ownerId: normalizedOwnerId,
        type: "following",
        viewerUserId: normalizedViewerUserId,
        page: 1,
        pageSize: FOLLOW_PREVIEW_LIMIT,
        scope: "public",
      }),
      normalizedViewerUserId === normalizedOwnerId ? getUnreadFollowNotificationsCount(normalizedOwnerId) : Promise.resolve(0),
    ]);
    followersCount = Math.max(0, Number(counts?.followersCount || 0));
    followingCount = Math.max(0, Number(counts?.followingCount || 0));
    viewerFollowingSet = nextViewerFollowingSet;
    followingPreviewPayload = nextFollowingPreviewPayload;
    unreadFollowersCount = nextUnreadFollowersCount;
  }

  const requiresAuth = !normalizedViewerUserId;
  const canFollow = normalizedOwnerId !== normalizedViewerUserId;
  return {
    counts: {
      followers: followersCount,
      following: followingCount,
    },
    viewer: {
      isFollowing: viewerFollowingSet.has(normalizedOwnerId),
      canFollow,
      requiresAuth,
    },
    unreadFollowersCount,
    previews: {
      following: Array.isArray(followingPreviewPayload.items) ? followingPreviewPayload.items : [],
    },
  };
}

async function followUserBySlug({ slug, followerUserId, summaryScope = "owner" } = {}) {
  assertFollowStorageWritable();
  const normalizedFollowerUserId = String(followerUserId || "").trim();
  if (!normalizedFollowerUserId) {
    const error = new Error("Unauthorized");
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  const target = await findPublicFollowTargetBySlug(slug);
  if (!target?.ownerId) {
    const error = new Error("Profile not found");
    error.code = "FOLLOW_TARGET_NOT_FOUND";
    throw error;
  }
  if (target.ownerId === normalizedFollowerUserId) {
    const error = new Error("Cannot follow yourself");
    error.code = "FOLLOW_SELF_FORBIDDEN";
    throw error;
  }

  let created = false;
  try {
    await prisma.userFollow.create({
      data: {
        followerId: normalizedFollowerUserId,
        followeeId: target.ownerId,
      },
    });
    created = true;
  } catch (error) {
    if (error?.code === "P2002") {
      created = false;
    } else if (isFollowStorageMissing(error)) {
      const nextError = new Error("Follow storage unavailable");
      nextError.code = "FOLLOW_STORAGE_UNAVAILABLE";
      throw nextError;
    } else {
      throw error;
    }
  }

  await syncLegacyUserContactSubscription({
    followerUserId: normalizedFollowerUserId,
    followeeId: target.ownerId,
    slug: target.slug,
    subscribed: true,
  });

  if (created) {
    await createFollowNotification({
      followeeId: target.ownerId,
      follower: target.ownerId === normalizedFollowerUserId
        ? null
        : await prisma.user.findUnique({
          where: { id: normalizedFollowerUserId },
          select: getFollowUserSelect(),
        }).catch(() => null),
    });
  }

  return {
    ok: true,
    followed: true,
    target,
    summary: await getFollowSummaryForOwner({
      ownerId: target.ownerId,
      viewerUserId: normalizedFollowerUserId,
      scope: summaryScope,
    }),
  };
}

async function unfollowUserBySlug({ slug, followerUserId, summaryScope = "owner" } = {}) {
  assertFollowStorageWritable();
  const normalizedFollowerUserId = String(followerUserId || "").trim();
  if (!normalizedFollowerUserId) {
    const error = new Error("Unauthorized");
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  const target = await findPublicFollowTargetBySlug(slug);
  if (!target?.ownerId) {
    const error = new Error("Profile not found");
    error.code = "FOLLOW_TARGET_NOT_FOUND";
    throw error;
  }
  if (target.ownerId === normalizedFollowerUserId) {
    const error = new Error("Cannot unfollow yourself");
    error.code = "FOLLOW_SELF_FORBIDDEN";
    throw error;
  }

  try {
    await prisma.userFollow.deleteMany({
      where: {
        followerId: normalizedFollowerUserId,
        followeeId: target.ownerId,
      },
    });
  } catch (error) {
    if (isFollowStorageMissing(error)) {
      const nextError = new Error("Follow storage unavailable");
      nextError.code = "FOLLOW_STORAGE_UNAVAILABLE";
      throw nextError;
    }
    throw error;
  }

  await syncLegacyUserContactSubscription({
    followerUserId: normalizedFollowerUserId,
    followeeId: target.ownerId,
    slug: target.slug,
    subscribed: false,
  });

  return {
    ok: true,
    followed: false,
    target,
    summary: await getFollowSummaryForOwner({
      ownerId: target.ownerId,
      viewerUserId: normalizedFollowerUserId,
      scope: summaryScope,
    }),
  };
}

async function toggleFollowBySlug({ slug, followerUserId, summaryScope = "owner" } = {}) {
  const target = await findPublicFollowTargetBySlug(slug);
  if (!target?.ownerId) {
    const error = new Error("Profile not found");
    error.code = "FOLLOW_TARGET_NOT_FOUND";
    throw error;
  }
  const viewerFollowingSet = await getViewerFollowLookup(followerUserId, [target.ownerId]);
  if (viewerFollowingSet.has(target.ownerId)) {
    return unfollowUserBySlug({ slug, followerUserId, summaryScope });
  }
  return followUserBySlug({ slug, followerUserId, summaryScope });
}

module.exports = {
  FOLLOW_LIST_PAGE_SIZE,
  FOLLOW_PREVIEW_LIMIT,
  isFollowStorageMissing,
  normalizeFollowListType,
  resolveFollowPage,
  resolveFollowPageSize,
  withMissingFollowFallback,
  findPublicFollowTargetBySlug,
  getViewerFollowLookup,
  getUnreadFollowNotificationsCount,
  markFollowNotificationsRead,
  getFollowSummaryForOwner,
  listFollowItemsByOwner,
  followUserBySlug,
  unfollowUserBySlug,
  toggleFollowBySlug,
};
