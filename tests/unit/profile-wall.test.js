const prismaModulePath = require.resolve("../../src/db/prisma");
const envModulePath = require.resolve("../../src/config/env");
const wallServiceModulePath = require.resolve("../../src/services/profile-wall");

const mockPrisma = {
  profileWallPost: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  profileWallPostLike: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  profileWallPostComment: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  $transaction: vi.fn(),
};

require.cache[prismaModulePath] = {
  id: prismaModulePath,
  filename: prismaModulePath,
  loaded: true,
  exports: { prisma: mockPrisma },
};

require.cache[envModulePath] = {
  id: envModulePath,
  filename: envModulePath,
  loaded: true,
  exports: {
    env: {
      TIMEZONE: "Asia/Tashkent",
    },
  },
};

delete require.cache[wallServiceModulePath];
const wallService = require("../../src/services/profile-wall");

function buildPost(overrides = {}) {
  return {
    id: "post_1",
    ownerId: "user_1",
    content: "Тест",
    status: "published",
    createdAt: new Date("2026-05-03T10:00:00.000Z"),
    updatedAt: new Date("2026-05-03T10:00:00.000Z"),
    hiddenAt: null,
    deletedAt: null,
    _count: { likes: 0 },
    ...overrides,
  };
}

function buildComment(overrides = {}) {
  return {
    id: "comment_1",
    postId: "post_1",
    userId: "user_2",
    content: "Комментарий",
    createdAt: new Date("2026-05-03T11:00:00.000Z"),
    updatedAt: new Date("2026-05-03T11:00:00.000Z"),
    user: {
      id: "user_2",
      displayName: "Ali",
      firstName: "Ali",
      lastName: "",
      username: "ali",
      login: "ali_login",
      profileCard: {
        avatarUrl: "/uploads/comment-avatar.webp",
      },
    },
    ...overrides,
  };
}

describe("profile wall service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.profileWallPost.count.mockResolvedValue(0);
    mockPrisma.profileWallPost.findMany.mockResolvedValue([]);
    mockPrisma.profileWallPost.findFirst.mockResolvedValue(null);
    mockPrisma.profileWallPost.create.mockResolvedValue(null);
    mockPrisma.profileWallPost.update.mockResolvedValue(null);
    mockPrisma.profileWallPostLike.findMany.mockResolvedValue([]);
    mockPrisma.profileWallPostLike.create.mockResolvedValue({});
    mockPrisma.profileWallPostLike.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.profileWallPostComment.findMany.mockResolvedValue([]);
    mockPrisma.profileWallPostComment.findFirst.mockResolvedValue(null);
    mockPrisma.profileWallPostComment.create.mockResolvedValue({});
    mockPrisma.profileWallPostComment.delete.mockResolvedValue({});
    mockPrisma.$transaction.mockReset();
  });

  test("admin wall listing includes deleted posts", async () => {
    await wallService.listAdminWallPosts({ ownerId: "user_1" });
    const where = mockPrisma.profileWallPost.findMany.mock.calls[0][0].where;
    expect(where.status.in).toContain("published");
    expect(where.status.in).toContain("hidden");
    expect(where.status.in).toContain("deleted");
  });

  test("wall summary blocks second post within the same Tashkent day", async () => {
    mockPrisma.profileWallPost.count.mockResolvedValue(1);

    const summary = await wallService.getWallSummary(
      { id: "user_1", plan: "premium" },
      { now: new Date("2026-05-03T10:00:00.000Z") },
    );

    expect(summary.canUseWall).toBe(true);
    expect(summary.canPostNow).toBe(false);
    expect(summary.todayPostCount).toBe(1);
    expect(summary.nextPostAt).toBe("2026-05-03T19:00:00.000Z");
  });

  test("createWallPost rejects when daily limit is already used", async () => {
    mockPrisma.$transaction.mockImplementation(async (callback) =>
      callback({
        $executeRaw: vi.fn().mockResolvedValue(0),
        profileWallPost: {
          count: vi.fn().mockResolvedValue(1),
          create: vi.fn(),
        },
      }),
    );

    await expect(
      wallService.createWallPost({
        ownerId: "user_1",
        content: "Сегодняшний пост",
        now: new Date("2026-05-03T10:00:00.000Z"),
      }),
    ).rejects.toMatchObject({ code: "WALL_POST_LIMIT_REACHED" });
  });

  test("listPublicWallPosts maps comments and viewerCanDelete", async () => {
    mockPrisma.profileWallPost.findMany.mockResolvedValue([buildPost()]);
    mockPrisma.profileWallPost.count.mockResolvedValue(1);
    mockPrisma.profileWallPostComment.findMany.mockResolvedValue([
      buildComment({
        userId: "user_1",
        user: {
          id: "user_1",
          displayName: "",
          firstName: "User",
          lastName: "One",
          username: "",
          login: "",
          profileCard: { avatarUrl: "" },
        },
      }),
    ]);

    const result = await wallService.listPublicWallPosts({
      ownerId: "user_1",
      viewerUserId: "user_1",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "post_1",
      commentsCount: 1,
      comments: [
        {
          id: "comment_1",
          viewerCanDelete: true,
          author: {
            name: "User One",
            initials: "UO",
          },
        },
      ],
    });
  });

  test("addWallPostComment rejects hidden owner post", async () => {
    mockPrisma.profileWallPost.findFirst.mockResolvedValue(
      buildPost({
        status: "hidden",
        _count: { likes: 0 },
      }),
    );

    await expect(
      wallService.addWallPostComment({
        ownerId: "user_1",
        postId: "post_1",
        viewerUserId: "user_1",
        content: "Новый комментарий",
        scope: "owner",
      }),
    ).rejects.toMatchObject({ code: "WALL_POST_NOT_COMMENTABLE" });
  });

  test("deleteWallPostComment rejects deleting someone else's comment", async () => {
    mockPrisma.profileWallPost.findFirst.mockResolvedValue(buildPost());
    mockPrisma.profileWallPostComment.findFirst.mockResolvedValue({
      id: "comment_1",
      postId: "post_1",
      userId: "user_2",
    });

    await expect(
      wallService.deleteWallPostComment({
        ownerId: "user_1",
        postId: "post_1",
        commentId: "comment_1",
        viewerUserId: "user_3",
      }),
    ).rejects.toMatchObject({ code: "WALL_COMMENT_FORBIDDEN" });
  });

  test("addWallPostLike allows self-like", async () => {
    mockPrisma.profileWallPost.findFirst
      .mockResolvedValueOnce(buildPost())
      .mockResolvedValueOnce(
        buildPost({
          _count: { likes: 1 },
        }),
      );
    mockPrisma.profileWallPostLike.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ postId: "post_1" }]);

    const result = await wallService.addWallPostLike({
      ownerId: "user_1",
      postId: "post_1",
      viewerUserId: "user_1",
    });

    expect(mockPrisma.profileWallPostLike.create).toHaveBeenCalledWith({
      data: {
        postId: "post_1",
        userId: "user_1",
      },
    });
    expect(result).toMatchObject({
      id: "post_1",
      ownerId: "user_1",
      likesCount: 1,
      viewerHasLiked: true,
      viewerCanLike: true,
      commentsCount: 0,
      comments: [],
    });
  });
});
