const { addDays, startOfDay } = require("date-fns");
const { fromZonedTime, toZonedTime } = require("date-fns-tz");

const { prisma } = require("../db/prisma");
const { env } = require("../config/env");
const { canCreateCard } = require("./profile");
const { isPublicProfileVisible } = require("./subscription");

const WALL_POST_CONTENT_MAX = 280;
const WALL_COMMENT_CONTENT_MAX = 1000;
const WALL_PUBLIC_PAGE_SIZE = 10;
const WALL_OWNER_PAGE_SIZE = 20;
const WALL_ADMIN_PAGE_SIZE = 20;
const WALL_PUBLIC_STATUS = "published";
const WALL_OWNER_VISIBLE_STATUSES = ["published", "hidden"];
const WALL_ADMIN_VISIBLE_STATUSES = ["published", "hidden", "deleted"];
const WALL_ALL_STATUSES = ["published", "hidden", "deleted"];
const WALL_LINKABLE_SLUG_STATUSES = ["approved", "active", "paused"];

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
      message.includes("update") ||
      message.includes("delete"))
  );
}

function isWallStorageMissing(error) {
  return (
    isMissingModelTable(error, "ProfileWallPost") ||
    isMissingModelColumn(error, "ProfileWallPost") ||
    isMissingModelTable(error, "ProfileWallPostLike") ||
    isMissingModelColumn(error, "ProfileWallPostLike") ||
    isMissingModelTable(error, "ProfileWallPostComment") ||
    isMissingModelColumn(error, "ProfileWallPostComment") ||
    isMissingModelDelegateError(error)
  );
}

async function withMissingTableFallback(modelName, fallbackValue, callback) {
  if (!getModelDelegate(modelName)) {
    return fallbackValue;
  }
  try {
    return await callback();
  } catch (error) {
    if (isMissingModelTable(error, modelName) || isMissingModelColumn(error, modelName) || isMissingModelDelegateError(error)) {
      return fallbackValue;
    }
    throw error;
  }
}

function resolveWallPageSize(rawPageSize, fallback, max) {
  const parsed = Number(rawPageSize);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(max, Math.round(parsed)));
}

function resolveWallPage(rawPage) {
  const parsed = Number(rawPage);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.max(1, Math.round(parsed));
}

function normalizeWallPostContent(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trim()
    .slice(0, WALL_POST_CONTENT_MAX);
}

function normalizeWallCommentContent(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+$/g, ""))
    .join("\n")
    .trim()
    .slice(0, WALL_COMMENT_CONTENT_MAX);
}

function normalizeWallCommentsEnabled(value, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "on", "yes"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "off", "no"].includes(normalized)) {
      return false;
    }
  }
  return Boolean(fallback);
}

function getWallDayWindow(now = new Date(), timezone = env.TIMEZONE || "Asia/Tashkent") {
  const current = now instanceof Date ? now : new Date(now);
  const zonedNow = toZonedTime(current, timezone);
  const dayStartLocal = startOfDay(zonedNow);
  const dayEndLocal = addDays(dayStartLocal, 1);
  const startUtc = fromZonedTime(dayStartLocal, timezone);
  const endUtc = fromZonedTime(dayEndLocal, timezone);
  return {
    timezone,
    startUtc,
    endUtc,
    nextPostAt: endUtc,
  };
}

function canUseWall(user) {
  return canCreateCard(user);
}

function toWallStatusLabel(status) {
  switch (String(status || "").toLowerCase()) {
    case "published":
      return "Опубликован";
    case "hidden":
      return "Скрыт";
    case "deleted":
      return "Удален";
    default:
      return "Неизвестно";
  }
}

function buildEditedFlag(createdAt, updatedAt) {
  const createdMs = new Date(createdAt || 0).getTime();
  const updatedMs = new Date(updatedAt || 0).getTime();
  if (!Number.isFinite(createdMs) || !Number.isFinite(updatedMs)) {
    return false;
  }
  return updatedMs - createdMs > 1000;
}

function getWallPostBaseSelect() {
  return {
    id: true,
    ownerId: true,
    content: true,
    commentsEnabled: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    hiddenAt: true,
    deletedAt: true,
    _count: {
      select: {
        likes: true,
      },
    },
  };
}

function getWallCommentBaseSelect() {
  return {
    id: true,
    postId: true,
    userId: true,
    content: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        displayName: true,
        firstName: true,
        lastName: true,
        username: true,
        login: true,
        isVerified: true,
        status: true,
        plan: true,
        subscriptionStartedAt: true,
        subscriptionExpiresAt: true,
        slugs: {
          where: {
            status: {
              in: WALL_LINKABLE_SLUG_STATUSES,
            },
          },
          orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            fullSlug: true,
          },
        },
        profileCard: {
          select: {
            avatarUrl: true,
          },
        },
      },
    },
  };
}

function getHomeWallPostSelect() {
  return {
    id: true,
    ownerId: true,
    content: true,
    status: true,
    createdAt: true,
    updatedAt: true,
    _count: {
      select: {
        likes: true,
        comments: true,
      },
    },
    owner: {
      select: {
        id: true,
        status: true,
        plan: true,
        subscriptionStartedAt: true,
        subscriptionExpiresAt: true,
        displayName: true,
        firstName: true,
        login: true,
        username: true,
        isVerified: true,
        verifiedCompany: true,
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
              in: WALL_LINKABLE_SLUG_STATUSES,
            },
          },
          orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            fullSlug: true,
          },
        },
      },
    },
  };
}

function getWallCommentAuthorName(user) {
  const displayName = String(user?.displayName || "").trim();
  if (displayName) {
    return displayName;
  }
  const firstName = String(user?.firstName || "").trim();
  const lastName = String(user?.lastName || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }
  const login = String(user?.login || "").trim();
  if (login) {
    return login;
  }
  const username = String(user?.username || "").trim();
  if (username) {
    return username;
  }
  return "UNQX User";
}

function formatWallAuthorHandle(value) {
  const normalized = String(value || "").trim().replace(/^@+/, "");
  return normalized ? `@${normalized}` : "";
}

function getWallCommentAuthorPublicLabel(user, fallbackLabel = "") {
  const loginLabel = formatWallAuthorHandle(user?.login);
  if (loginLabel) {
    return loginLabel;
  }
  const usernameLabel = formatWallAuthorHandle(user?.username);
  if (usernameLabel) {
    return usernameLabel;
  }
  const fallback = String(fallbackLabel || "").trim();
  return fallback || "UNQX User";
}

function getWallCommentAuthorInitials(name) {
  const initials = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] ? part[0].toUpperCase() : ""))
    .join("");
  return initials || "UN";
}

function getWallCommentAuthorProfileHref(user) {
  if (!user || !isPublicProfileVisible(user)) {
    return null;
  }
  const slug = String(user?.slugs?.[0]?.fullSlug || "").trim().toUpperCase();
  if (!slug) {
    return null;
  }
  return `/${encodeURIComponent(slug)}`;
}

function mapWallCommentItem(row, options = {}) {
  if (!row) return null;
  const viewerUserId = String(options.viewerUserId || "").trim();
  const postOwnerId = String(options.ownerId || "").trim();
  const authorName = getWallCommentAuthorName(row.user);
  const userId = String(row.userId || "").trim();
  return {
    id: String(row.id || "").trim(),
    postId: String(row.postId || "").trim(),
    userId,
    content: String(row.content || ""),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    viewerCanDelete: Boolean(viewerUserId) && (viewerUserId === userId || viewerUserId === postOwnerId),
    author: {
      id: String(row.user?.id || userId).trim(),
      name: authorName,
      wallAuthorLabel: getWallCommentAuthorPublicLabel(row.user, authorName),
      verified: Boolean(row.user?.isVerified),
      profileHref: getWallCommentAuthorProfileHref(row.user),
      avatarUrl: String(row.user?.profileCard?.avatarUrl || "").trim() || null,
      initials: getWallCommentAuthorInitials(authorName),
    },
  };
}

async function listWallCommentsByPostIds({ postIds, viewerUserId = "", ownerId = "" }) {
  const normalizedPostIds = Array.isArray(postIds)
    ? postIds.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const normalizedOwnerId = String(ownerId || "").trim();
  if (!normalizedPostIds.length) {
    return new Map();
  }

  const rows = await withMissingTableFallback("ProfileWallPostComment", [], () =>
    prisma.profileWallPostComment.findMany({
      where: {
        postId: { in: normalizedPostIds },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: getWallCommentBaseSelect(),
    }),
  );

  const grouped = new Map();
  for (const row of rows) {
    const postId = String(row.postId || "").trim();
    if (!postId) {
      continue;
    }
    if (!grouped.has(postId)) {
      grouped.set(postId, []);
    }
    const mapped = mapWallCommentItem(row, {
      viewerUserId,
      ownerId: normalizedOwnerId,
    });
    if (mapped) {
      grouped.get(postId).push(mapped);
    }
  }
  return grouped;
}

function mapWallPostItem(row, options = {}) {
  if (!row) return null;
  const likesCount = Number(row?._count?.likes || 0);
  const viewerLikedPostIds = options.viewerLikedPostIds instanceof Set ? options.viewerLikedPostIds : new Set();
  const commentsByPostId = options.commentsByPostId instanceof Map ? options.commentsByPostId : new Map();
  const viewerUserId = String(options.viewerUserId || "").trim();
  const ownerId = String(row.ownerId || "").trim();
  const postId = String(row.id || "").trim();
  const comments = Array.isArray(commentsByPostId.get(postId)) ? commentsByPostId.get(postId) : [];
  return {
    id: postId,
    ownerId,
    content: String(row.content || ""),
    commentsEnabled: row.commentsEnabled !== false,
    status: String(row.status || "published"),
    statusLabel: toWallStatusLabel(row.status),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    hiddenAt: row.hiddenAt || null,
    deletedAt: row.deletedAt || null,
    likesCount,
    commentsCount: comments.length,
    comments,
    viewerHasLiked: viewerLikedPostIds.has(postId),
    viewerCanLike: Boolean(viewerUserId) && String(row.status || "") === WALL_PUBLIC_STATUS,
    isEdited: buildEditedFlag(row.createdAt, row.updatedAt),
  };
}

async function listWallPostsByOwner({
  ownerId,
  viewerUserId = "",
  page = 1,
  pageSize = WALL_OWNER_PAGE_SIZE,
  statuses = WALL_OWNER_VISIBLE_STATUSES,
}) {
  const normalizedOwnerId = String(ownerId || "").trim();
  const normalizedPage = resolveWallPage(page);
  const normalizedPageSize = resolveWallPageSize(pageSize, WALL_OWNER_PAGE_SIZE, 50);
  if (!normalizedOwnerId) {
    return {
      items: [],
      pagination: { page: normalizedPage, pageSize: normalizedPageSize, total: 0, hasMore: false },
    };
  }

  const safeStatuses = Array.isArray(statuses) && statuses.length ? statuses : WALL_OWNER_VISIBLE_STATUSES;
  const where = {
    ownerId: normalizedOwnerId,
    status: { in: safeStatuses },
  };

  const [rows, total] = await Promise.all([
    prisma.profileWallPost.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (normalizedPage - 1) * normalizedPageSize,
      take: normalizedPageSize,
      select: getWallPostBaseSelect(),
    }),
    prisma.profileWallPost.count({ where }),
  ]);

  const postIds = rows.map((item) => item.id);
  const [viewerLikedRows, commentsByPostId] = await Promise.all([
    viewerUserId && postIds.length
      ? prisma.profileWallPostLike.findMany({
        where: {
          userId: viewerUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      })
      : [],
    listWallCommentsByPostIds({
      postIds,
      viewerUserId,
      ownerId: normalizedOwnerId,
    }),
  ]);
  const viewerLikedPostIds = new Set(viewerLikedRows.map((item) => String(item.postId || "").trim()));

  return {
    items: rows
      .map((row) => mapWallPostItem(row, { viewerUserId, viewerLikedPostIds, commentsByPostId }))
      .filter(Boolean),
    pagination: {
      page: normalizedPage,
      pageSize: normalizedPageSize,
      total,
      hasMore: normalizedPage * normalizedPageSize < total,
    },
  };
}

async function listPublicWallPosts({
  ownerId,
  viewerUserId = "",
  page = 1,
  pageSize = WALL_PUBLIC_PAGE_SIZE,
}) {
  return listWallPostsByOwner({
    ownerId,
    viewerUserId,
    page,
    pageSize: resolveWallPageSize(pageSize, WALL_PUBLIC_PAGE_SIZE, 20),
    statuses: [WALL_PUBLIC_STATUS],
  });
}

async function listLatestHomeWallPosts({ limit = 3 } = {}) {
  const normalizedLimit = Math.max(1, Math.min(12, Math.round(Number(limit || 3) || 3)));
  const rows = await withMissingTableFallback("ProfileWallPost", [], () =>
    prisma.profileWallPost.findMany({
      where: {
        status: WALL_PUBLIC_STATUS,
        owner: {
          status: "active",
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: Math.max(normalizedLimit * 8, 24),
      select: getHomeWallPostSelect(),
    }),
  );

  const items = [];
  for (const row of rows) {
    const owner = row?.owner;
    const primarySlug = String(owner?.slugs?.[0]?.fullSlug || "").trim().toUpperCase();
    if (!owner || !primarySlug || !isPublicProfileVisible(owner)) {
      continue;
    }

    const authorName =
      String(owner?.profileCard?.name || owner?.displayName || owner?.firstName || "UNQX User").trim() || "UNQX User";
    items.push({
      id: String(row.id || "").trim(),
      ownerId: String(row.ownerId || "").trim(),
      content: String(row.content || ""),
      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null,
      likesCount: Math.max(0, Number(row?._count?.likes || 0)),
      commentsCount: Math.max(0, Number(row?._count?.comments || 0)),
      postHref: `/${encodeURIComponent(primarySlug)}#wall-post-${encodeURIComponent(String(row.id || "").trim())}`,
      author: {
        userId: String(owner.id || "").trim(),
        name: authorName,
        handle: String(owner?.login || owner?.username || "").trim(),
        avatarUrl: String(owner?.profileCard?.avatarUrl || "").trim() || null,
        primarySlug,
        role: String(owner?.profileCard?.role || owner?.verifiedCompany || "").trim(),
        verified: Boolean(owner?.isVerified),
        profileHref: `/${encodeURIComponent(primarySlug)}`,
      },
    });

    if (items.length >= normalizedLimit) {
      break;
    }
  }

  return items;
}

async function listAdminWallPosts({
  ownerId,
  page = 1,
  pageSize = WALL_ADMIN_PAGE_SIZE,
}) {
  return listWallPostsByOwner({
    ownerId,
    viewerUserId: "",
    page,
    pageSize: resolveWallPageSize(pageSize, WALL_ADMIN_PAGE_SIZE, 50),
    statuses: WALL_ADMIN_VISIBLE_STATUSES,
  });
}

async function getWallSummary(user, options = {}) {
  const wallEnabled = canUseWall(user);
  if (!wallEnabled || !user?.id) {
    return {
      canUseWall: wallEnabled,
      canPostNow: false,
      nextPostAt: null,
      todayPostCount: 0,
    };
  }

  const dayWindow = getWallDayWindow(options.now, options.timezone);
  const todayPostCount = await withMissingTableFallback("ProfileWallPost", 0, () =>
    prisma.profileWallPost.count({
      where: {
        ownerId: user.id,
        createdAt: {
          gte: dayWindow.startUtc,
          lt: dayWindow.endUtc,
        },
      },
    }),
  );

  return {
    canUseWall: true,
    canPostNow: todayPostCount < 1,
    nextPostAt: todayPostCount < 1 ? null : dayWindow.nextPostAt.toISOString(),
    todayPostCount,
  };
}

async function assertWallPostCreateAllowed(tx, ownerId, options = {}) {
  const normalizedOwnerId = String(ownerId || "").trim();
  if (!normalizedOwnerId) {
    const error = new Error("Owner id is required");
    error.code = "WALL_OWNER_REQUIRED";
    throw error;
  }

  const dayWindow = getWallDayWindow(options.now, options.timezone);
  const lockKey = `profile_wall_post:${normalizedOwnerId}:${dayWindow.startUtc.toISOString().slice(0, 10)}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

  const todayPostCount = await tx.profileWallPost.count({
    where: {
      ownerId: normalizedOwnerId,
      createdAt: {
        gte: dayWindow.startUtc,
        lt: dayWindow.endUtc,
      },
    },
  });

  if (todayPostCount >= 1) {
    const error = new Error("Daily wall post limit reached");
    error.code = "WALL_POST_LIMIT_REACHED";
    error.nextPostAt = dayWindow.nextPostAt.toISOString();
    error.todayPostCount = todayPostCount;
    throw error;
  }

  return { todayPostCount, dayWindow };
}

async function createWallPost({ ownerId, content, commentsEnabled, now, timezone } = {}) {
  const normalizedOwnerId = String(ownerId || "").trim();
  const normalizedContent = normalizeWallPostContent(content);
  const normalizedCommentsEnabled = normalizeWallCommentsEnabled(commentsEnabled, true);
  if (!normalizedOwnerId) {
    const error = new Error("Owner id is required");
    error.code = "WALL_OWNER_REQUIRED";
    throw error;
  }
  if (!normalizedContent) {
    const error = new Error("Post content is required");
    error.code = "WALL_POST_CONTENT_REQUIRED";
    throw error;
  }

  const created = await prisma.$transaction(async (tx) => {
    await assertWallPostCreateAllowed(tx, normalizedOwnerId, { now, timezone });
    return tx.profileWallPost.create({
      data: {
        ownerId: normalizedOwnerId,
        content: normalizedContent,
        commentsEnabled: normalizedCommentsEnabled,
        status: WALL_PUBLIC_STATUS,
      },
      select: getWallPostBaseSelect(),
    });
  });

  return mapWallPostItem(created, {
    viewerUserId: normalizedOwnerId,
    commentsByPostId: new Map([[String(created.id || "").trim(), []]]),
  });
}

async function getOwnerWallPostOrThrow({ postId, ownerId, allowedStatuses = WALL_OWNER_VISIBLE_STATUSES }) {
  const normalizedPostId = String(postId || "").trim();
  const normalizedOwnerId = String(ownerId || "").trim();
  const safeStatuses = Array.isArray(allowedStatuses) && allowedStatuses.length ? allowedStatuses : WALL_OWNER_VISIBLE_STATUSES;
  const post = await prisma.profileWallPost.findFirst({
    where: {
      id: normalizedPostId,
      ownerId: normalizedOwnerId,
      status: { in: safeStatuses },
    },
    select: getWallPostBaseSelect(),
  });

  if (!post) {
    const error = new Error("Wall post not found");
    error.code = "WALL_POST_NOT_FOUND";
    throw error;
  }

  return post;
}

async function updateWallPostContentAsOwner({ postId, ownerId, content, commentsEnabled }) {
  const normalizedContent = normalizeWallPostContent(content);
  if (!normalizedContent) {
    const error = new Error("Post content is required");
    error.code = "WALL_POST_CONTENT_REQUIRED";
    throw error;
  }

  const current = await getOwnerWallPostOrThrow({ postId, ownerId });
  const normalizedCommentsEnabled = normalizeWallCommentsEnabled(commentsEnabled, current.commentsEnabled !== false);

  const updated = await prisma.profileWallPost.update({
    where: { id: postId },
    data: {
      content: normalizedContent,
      commentsEnabled: normalizedCommentsEnabled,
      updatedAt: new Date(),
    },
    select: getWallPostBaseSelect(),
  });

  const commentsByPostId = await listWallCommentsByPostIds({
    postIds: [updated.id],
    viewerUserId: ownerId,
    ownerId,
  });
  return mapWallPostItem(updated, { viewerUserId: ownerId, commentsByPostId });
}

async function deleteWallPostAsOwner({ postId, ownerId }) {
  await getOwnerWallPostOrThrow({ postId, ownerId });

  const updated = await prisma.profileWallPost.update({
    where: { id: postId },
    data: {
      status: "deleted",
      deletedAt: new Date(),
      updatedAt: new Date(),
    },
    select: getWallPostBaseSelect(),
  });

  const commentsByPostId = await listWallCommentsByPostIds({
    postIds: [updated.id],
    viewerUserId: ownerId,
    ownerId,
  });
  return mapWallPostItem(updated, { viewerUserId: ownerId, commentsByPostId });
}

async function updateWallPostAsAdmin({ postId, ownerId, content, status }) {
  const normalizedStatus = status ? String(status).trim().toLowerCase() : "";
  const hasStatus = normalizedStatus.length > 0;
  const hasContent = typeof content !== "undefined";
  if (!hasStatus && !hasContent) {
    const error = new Error("Nothing to update");
    error.code = "WALL_POST_NO_CHANGES";
    throw error;
  }

  const current = await getOwnerWallPostOrThrow({ postId, ownerId, allowedStatuses: WALL_ADMIN_VISIBLE_STATUSES });
  const data = {};

  if (hasContent) {
    const normalizedContent = normalizeWallPostContent(content);
    if (!normalizedContent) {
      const error = new Error("Post content is required");
      error.code = "WALL_POST_CONTENT_REQUIRED";
      throw error;
    }
    data.content = normalizedContent;
  }

  if (hasStatus) {
    if (!WALL_ALL_STATUSES.includes(normalizedStatus)) {
      const error = new Error("Invalid wall post status");
      error.code = "WALL_POST_STATUS_INVALID";
      throw error;
    }
    data.status = normalizedStatus;
    if (normalizedStatus === "hidden") {
      data.hiddenAt = new Date();
    }
    if (normalizedStatus === "published") {
      data.hiddenAt = null;
      data.deletedAt = null;
    }
    if (normalizedStatus === "deleted") {
      data.deletedAt = new Date();
    }
  }

  if (!Object.keys(data).length) {
    const commentsByPostId = await listWallCommentsByPostIds({
      postIds: [current.id],
      viewerUserId: "",
      ownerId,
    });
    return mapWallPostItem(current, { commentsByPostId });
  }

  data.updatedAt = new Date();
  const updated = await prisma.profileWallPost.update({
    where: { id: current.id },
    data,
    select: getWallPostBaseSelect(),
  });

  const commentsByPostId = await listWallCommentsByPostIds({
    postIds: [updated.id],
    viewerUserId: "",
    ownerId,
  });
  return mapWallPostItem(updated, { commentsByPostId });
}

async function getWallPostItem({ ownerId, postId, viewerUserId = "", statuses = [WALL_PUBLIC_STATUS] }) {
  const post = await prisma.profileWallPost.findFirst({
    where: {
      id: String(postId || "").trim(),
      ownerId: String(ownerId || "").trim(),
      status: {
        in: Array.isArray(statuses) && statuses.length ? statuses : [WALL_PUBLIC_STATUS],
      },
    },
    select: getWallPostBaseSelect(),
  });
  if (!post) {
    const error = new Error("Wall post not found");
    error.code = "WALL_POST_NOT_FOUND";
    throw error;
  }

  const viewerLikedRows =
    viewerUserId
      ? await prisma.profileWallPostLike.findMany({
        where: {
          userId: viewerUserId,
          postId: post.id,
        },
        select: { postId: true },
      })
      : [];
  const viewerLikedPostIds = new Set(viewerLikedRows.map((item) => String(item.postId || "").trim()));
  const commentsByPostId = await listWallCommentsByPostIds({
    postIds: [post.id],
    viewerUserId,
    ownerId: String(post.ownerId || "").trim(),
  });
  return mapWallPostItem(post, { viewerUserId, viewerLikedPostIds, commentsByPostId });
}

async function getPublicWallPostItem({ ownerId, postId, viewerUserId = "" }) {
  return getWallPostItem({
    ownerId,
    postId,
    viewerUserId,
    statuses: [WALL_PUBLIC_STATUS],
  });
}

async function getOwnerWallPostItem({
  ownerId,
  postId,
  viewerUserId = "",
  allowedStatuses = WALL_OWNER_VISIBLE_STATUSES,
}) {
  return getWallPostItem({
    ownerId,
    postId,
    viewerUserId,
    statuses: allowedStatuses,
  });
}

async function addWallPostLike({ ownerId, postId, viewerUserId }) {
  const normalizedViewerUserId = String(viewerUserId || "").trim();
  const normalizedOwnerId = String(ownerId || "").trim();
  const normalizedPostId = String(postId || "").trim();
  if (!normalizedViewerUserId) {
    const error = new Error("Authentication required");
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  await getPublicWallPostItem({
    ownerId: normalizedOwnerId,
    postId: normalizedPostId,
    viewerUserId: normalizedViewerUserId,
  });

  try {
    await prisma.profileWallPostLike.create({
      data: {
        postId: normalizedPostId,
        userId: normalizedViewerUserId,
      },
    });
  } catch (error) {
    if (String(error?.code || "") !== "P2002") {
      throw error;
    }
  }

  return getPublicWallPostItem({
    ownerId: normalizedOwnerId,
    postId: normalizedPostId,
    viewerUserId: normalizedViewerUserId,
  });
}

async function removeWallPostLike({ ownerId, postId, viewerUserId }) {
  const normalizedViewerUserId = String(viewerUserId || "").trim();
  const normalizedOwnerId = String(ownerId || "").trim();
  const normalizedPostId = String(postId || "").trim();
  if (!normalizedViewerUserId) {
    const error = new Error("Authentication required");
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  await getPublicWallPostItem({
    ownerId: normalizedOwnerId,
    postId: normalizedPostId,
    viewerUserId: normalizedViewerUserId,
  });

  await prisma.profileWallPostLike.deleteMany({
    where: {
      postId: normalizedPostId,
      userId: normalizedViewerUserId,
    },
  });

  return getPublicWallPostItem({
    ownerId: normalizedOwnerId,
    postId: normalizedPostId,
    viewerUserId: normalizedViewerUserId,
  });
}

async function getWallPostCommentOrThrow({ postId, commentId }) {
  const comment = await prisma.profileWallPostComment.findFirst({
    where: {
      id: String(commentId || "").trim(),
      postId: String(postId || "").trim(),
    },
    select: {
      id: true,
      postId: true,
      userId: true,
    },
  });
  if (!comment) {
    const error = new Error("Wall comment not found");
    error.code = "WALL_COMMENT_NOT_FOUND";
    throw error;
  }
  return comment;
}

async function addWallPostComment({ ownerId, postId, viewerUserId, content, scope = "public" }) {
  const normalizedViewerUserId = String(viewerUserId || "").trim();
  const normalizedOwnerId = String(ownerId || "").trim();
  const normalizedPostId = String(postId || "").trim();
  const normalizedContent = normalizeWallCommentContent(content);
  const normalizedScope = scope === "owner" ? "owner" : "public";

  if (!normalizedViewerUserId) {
    const error = new Error("Authentication required");
    error.code = "AUTH_REQUIRED";
    throw error;
  }
  if (!normalizedContent) {
    const error = new Error("Comment content is required");
    error.code = "WALL_COMMENT_CONTENT_REQUIRED";
    throw error;
  }

  if (normalizedScope === "owner") {
    const post = await getOwnerWallPostOrThrow({
      postId: normalizedPostId,
      ownerId: normalizedOwnerId,
    });
    if (String(post.status || "").trim() !== WALL_PUBLIC_STATUS) {
      const error = new Error("Wall post is not commentable");
      error.code = "WALL_POST_NOT_COMMENTABLE";
      throw error;
    }
    if (post.commentsEnabled === false) {
      const error = new Error("Комментарии отключены автором для этого поста");
      error.code = "WALL_POST_NOT_COMMENTABLE";
      throw error;
    }
  } else {
    const post = await getPublicWallPostItem({
      ownerId: normalizedOwnerId,
      postId: normalizedPostId,
      viewerUserId: normalizedViewerUserId,
    });
    if (post.commentsEnabled === false) {
      const error = new Error("Комментарии отключены автором для этого поста");
      error.code = "WALL_POST_NOT_COMMENTABLE";
      throw error;
    }
  }

  await prisma.profileWallPostComment.create({
    data: {
      postId: normalizedPostId,
      userId: normalizedViewerUserId,
      content: normalizedContent,
    },
  });

  return normalizedScope === "owner"
    ? getOwnerWallPostItem({
      ownerId: normalizedOwnerId,
      postId: normalizedPostId,
      viewerUserId: normalizedViewerUserId,
    })
    : getPublicWallPostItem({
      ownerId: normalizedOwnerId,
      postId: normalizedPostId,
      viewerUserId: normalizedViewerUserId,
    });
}

async function deleteWallPostComment({ ownerId, postId, commentId, viewerUserId, scope = "public" }) {
  const normalizedViewerUserId = String(viewerUserId || "").trim();
  const normalizedOwnerId = String(ownerId || "").trim();
  const normalizedPostId = String(postId || "").trim();
  const normalizedCommentId = String(commentId || "").trim();
  const normalizedScope = scope === "owner" ? "owner" : "public";

  if (!normalizedViewerUserId) {
    const error = new Error("Authentication required");
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  if (normalizedScope === "owner") {
    await getOwnerWallPostOrThrow({
      postId: normalizedPostId,
      ownerId: normalizedOwnerId,
    });
  } else {
    await getPublicWallPostItem({
      ownerId: normalizedOwnerId,
      postId: normalizedPostId,
      viewerUserId: normalizedViewerUserId,
    });
  }

  const comment = await getWallPostCommentOrThrow({
    postId: normalizedPostId,
    commentId: normalizedCommentId,
  });
  if (
    String(comment.userId || "").trim() !== normalizedViewerUserId &&
    normalizedViewerUserId !== normalizedOwnerId
  ) {
    const error = new Error("Wall comment cannot be deleted by this user");
    error.code = "WALL_COMMENT_FORBIDDEN";
    throw error;
  }

  await prisma.profileWallPostComment.delete({
    where: {
      id: normalizedCommentId,
    },
  });

  return normalizedScope === "owner"
    ? getOwnerWallPostItem({
      ownerId: normalizedOwnerId,
      postId: normalizedPostId,
      viewerUserId: normalizedViewerUserId,
    })
    : getPublicWallPostItem({
      ownerId: normalizedOwnerId,
      postId: normalizedPostId,
      viewerUserId: normalizedViewerUserId,
    });
}

module.exports = {
  WALL_POST_CONTENT_MAX,
  WALL_COMMENT_CONTENT_MAX,
  WALL_PUBLIC_PAGE_SIZE,
  WALL_OWNER_PAGE_SIZE,
  WALL_ADMIN_PAGE_SIZE,
  WALL_PUBLIC_STATUS,
  WALL_OWNER_VISIBLE_STATUSES,
  WALL_ADMIN_VISIBLE_STATUSES,
  isWallStorageMissing,
  withMissingTableFallback,
  resolveWallPage,
  resolveWallPageSize,
  normalizeWallPostContent,
  normalizeWallCommentContent,
  getWallDayWindow,
  canUseWall,
  getWallSummary,
  listWallPostsByOwner,
  listPublicWallPosts,
  listLatestHomeWallPosts,
  listAdminWallPosts,
  createWallPost,
  updateWallPostContentAsOwner,
  deleteWallPostAsOwner,
  updateWallPostAsAdmin,
  addWallPostLike,
  removeWallPostLike,
  addWallPostComment,
  deleteWallPostComment,
  getPublicWallPostItem,
  getOwnerWallPostItem,
};
