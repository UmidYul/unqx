const { addDays, startOfDay } = require("date-fns");
const { fromZonedTime, toZonedTime } = require("date-fns-tz");

const { prisma } = require("../db/prisma");
const { env } = require("../config/env");
const { canCreateCard } = require("./profile");

const WALL_POST_CONTENT_MAX = 280;
const WALL_PUBLIC_PAGE_SIZE = 10;
const WALL_OWNER_PAGE_SIZE = 20;
const WALL_ADMIN_PAGE_SIZE = 20;
const WALL_PUBLIC_STATUS = "published";
const WALL_OWNER_VISIBLE_STATUSES = ["published", "hidden"];
const WALL_ADMIN_VISIBLE_STATUSES = ["published", "hidden", "deleted"];
const WALL_ALL_STATUSES = ["published", "hidden", "deleted"];

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
      message.includes("update"))
  );
}

function isWallStorageMissing(error) {
  return (
    isMissingModelTable(error, "ProfileWallPost") ||
    isMissingModelColumn(error, "ProfileWallPost") ||
    isMissingModelTable(error, "ProfileWallPostLike") ||
    isMissingModelColumn(error, "ProfileWallPostLike") ||
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

function mapWallPostItem(row, options = {}) {
  if (!row) return null;
  const likesCount = Number(row?._count?.likes || 0);
  const viewerLikedPostIds = options.viewerLikedPostIds instanceof Set ? options.viewerLikedPostIds : new Set();
  const viewerUserId = String(options.viewerUserId || "").trim();
  const ownerId = String(row.ownerId || "").trim();
  const postId = String(row.id || "").trim();
  return {
    id: postId,
    ownerId,
    content: String(row.content || ""),
    status: String(row.status || "published"),
    statusLabel: toWallStatusLabel(row.status),
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    hiddenAt: row.hiddenAt || null,
    deletedAt: row.deletedAt || null,
    likesCount,
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
      select: {
        id: true,
        ownerId: true,
        content: true,
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
      },
    }),
    prisma.profileWallPost.count({ where }),
  ]);

  const postIds = rows.map((item) => item.id);
  const viewerLikedRows =
    viewerUserId && postIds.length
      ? await prisma.profileWallPostLike.findMany({
        where: {
          userId: viewerUserId,
          postId: { in: postIds },
        },
        select: { postId: true },
      })
      : [];
  const viewerLikedPostIds = new Set(viewerLikedRows.map((item) => String(item.postId || "").trim()));

  return {
    items: rows.map((row) => mapWallPostItem(row, { viewerUserId, viewerLikedPostIds })).filter(Boolean),
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

async function createWallPost({ ownerId, content, now, timezone } = {}) {
  const normalizedOwnerId = String(ownerId || "").trim();
  const normalizedContent = normalizeWallPostContent(content);
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
        status: WALL_PUBLIC_STATUS,
      },
      select: {
        id: true,
        ownerId: true,
        content: true,
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
      },
    });
  });

  return mapWallPostItem(created, { viewerUserId: normalizedOwnerId });
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
    select: {
      id: true,
      ownerId: true,
      content: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      hiddenAt: true,
      deletedAt: true,
      _count: { select: { likes: true } },
    },
  });

  if (!post) {
    const error = new Error("Wall post not found");
    error.code = "WALL_POST_NOT_FOUND";
    throw error;
  }

  return post;
}

async function updateWallPostContentAsOwner({ postId, ownerId, content }) {
  const normalizedContent = normalizeWallPostContent(content);
  if (!normalizedContent) {
    const error = new Error("Post content is required");
    error.code = "WALL_POST_CONTENT_REQUIRED";
    throw error;
  }

  await getOwnerWallPostOrThrow({ postId, ownerId });

  const updated = await prisma.profileWallPost.update({
    where: { id: postId },
    data: {
      content: normalizedContent,
      updatedAt: new Date(),
    },
    select: {
      id: true,
      ownerId: true,
      content: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      hiddenAt: true,
      deletedAt: true,
      _count: { select: { likes: true } },
    },
  });

  return mapWallPostItem(updated, { viewerUserId: ownerId });
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
    select: {
      id: true,
      ownerId: true,
      content: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      hiddenAt: true,
      deletedAt: true,
      _count: { select: { likes: true } },
    },
  });

  return mapWallPostItem(updated, { viewerUserId: ownerId });
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

  const current = await getOwnerWallPostOrThrow({ postId, ownerId });
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
    return mapWallPostItem(current);
  }

  data.updatedAt = new Date();
  const updated = await prisma.profileWallPost.update({
    where: { id: current.id },
    data,
    select: {
      id: true,
      ownerId: true,
      content: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      hiddenAt: true,
      deletedAt: true,
      _count: { select: { likes: true } },
    },
  });

  return mapWallPostItem(updated);
}

async function getPublicWallPostItem({ ownerId, postId, viewerUserId = "" }) {
  const post = await prisma.profileWallPost.findFirst({
    where: {
      id: String(postId || "").trim(),
      ownerId: String(ownerId || "").trim(),
      status: WALL_PUBLIC_STATUS,
    },
    select: {
      id: true,
      ownerId: true,
      content: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      hiddenAt: true,
      deletedAt: true,
      _count: { select: { likes: true } },
    },
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
  return mapWallPostItem(post, { viewerUserId, viewerLikedPostIds });
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

  const post = await getPublicWallPostItem({
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

module.exports = {
  WALL_POST_CONTENT_MAX,
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
  getWallDayWindow,
  canUseWall,
  getWallSummary,
  listWallPostsByOwner,
  listPublicWallPosts,
  listAdminWallPosts,
  createWallPost,
  updateWallPostContentAsOwner,
  deleteWallPostAsOwner,
  updateWallPostAsAdmin,
  addWallPostLike,
  removeWallPostLike,
  getPublicWallPostItem,
};
