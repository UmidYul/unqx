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
    commentsEnabled: true,
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
      isVerified: false,
      status: "active",
      plan: "none",
      subscriptionStartedAt: null,
      subscriptionExpiresAt: null,
      slugs: [{ fullSlug: "ALI001" }],
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

  test("createWallPost enables comments by default", async () => {
    const createdRow = buildPost();
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      profileWallPost: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue(createdRow),
      },
    };
    mockPrisma.$transaction.mockImplementation(async (callback) => callback(tx));

    const result = await wallService.createWallPost({
      ownerId: "user_1",
      content: "Новый пост",
    });

    expect(tx.profileWallPost.create).toHaveBeenCalledWith({
      data: {
        ownerId: "user_1",
        content: "Новый пост",
        commentsEnabled: true,
        status: "published",
      },
      select: expect.any(Object),
    });
    expect(result).toMatchObject({
      id: "post_1",
      commentsEnabled: true,
    });
  });

  test("updateWallPostContentAsOwner saves commentsEnabled flag", async () => {
    mockPrisma.profileWallPost.findFirst.mockResolvedValue(buildPost());
    mockPrisma.profileWallPost.update.mockResolvedValue(buildPost({
      content: "Обновлённый пост",
      commentsEnabled: false,
      updatedAt: new Date("2026-05-03T12:00:00.000Z"),
    }));
    mockPrisma.profileWallPostComment.findMany.mockResolvedValue([]);

    const result = await wallService.updateWallPostContentAsOwner({
      ownerId: "user_1",
      postId: "post_1",
      content: "Обновлённый пост",
      commentsEnabled: false,
    });

    expect(mockPrisma.profileWallPost.update).toHaveBeenCalledWith({
      where: { id: "post_1" },
      data: {
        content: "Обновлённый пост",
        commentsEnabled: false,
        updatedAt: expect.any(Date),
      },
      select: expect.any(Object),
    });
    expect(result).toMatchObject({
      id: "post_1",
      commentsEnabled: false,
    });
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
      commentsEnabled: true,
      commentsCount: 1,
      comments: [
        {
          id: "comment_1",
          viewerCanDelete: true,
          author: {
            name: "User One",
            wallAuthorLabel: "User One",
            initials: "UO",
          },
        },
      ],
    });
  });

  test("listPublicWallPosts uses login label for public comment author when login exists", async () => {
    mockPrisma.profileWallPost.findMany.mockResolvedValue([buildPost()]);
    mockPrisma.profileWallPost.count.mockResolvedValue(1);
    mockPrisma.profileWallPostComment.findMany.mockResolvedValue([buildComment()]);

    const result = await wallService.listPublicWallPosts({
      ownerId: "user_1",
      viewerUserId: "user_3",
    });

    expect(result.items[0]?.comments?.[0]).toMatchObject({
      author: {
        name: "Ali",
        wallAuthorLabel: "@ali_login",
        profileHref: "/ALI001",
      },
    });
  });

  test("listPublicWallPosts falls back to legacy username when login is missing", async () => {
    mockPrisma.profileWallPost.findMany.mockResolvedValue([buildPost()]);
    mockPrisma.profileWallPost.count.mockResolvedValue(1);
    mockPrisma.profileWallPostComment.findMany.mockResolvedValue([
      buildComment({
        user: {
          id: "user_2",
          displayName: "",
          firstName: "",
          lastName: "",
          username: "legacy_ali",
          login: "",
          isVerified: false,
          status: "active",
          plan: "none",
          subscriptionStartedAt: null,
          subscriptionExpiresAt: null,
          slugs: [{ fullSlug: "ALI002" }],
          profileCard: {
            avatarUrl: "",
          },
        },
      }),
    ]);

    const result = await wallService.listPublicWallPosts({
      ownerId: "user_1",
      viewerUserId: "user_3",
    });

    expect(result.items[0]?.comments?.[0]).toMatchObject({
      author: {
        name: "legacy_ali",
        wallAuthorLabel: "@legacy_ali",
        verified: false,
        profileHref: "/ALI002",
      },
    });
  });

  test("listPublicWallPosts uses login fallback for author name and maps verification", async () => {
    mockPrisma.profileWallPost.findMany.mockResolvedValue([buildPost()]);
    mockPrisma.profileWallPost.count.mockResolvedValue(1);
    mockPrisma.profileWallPostComment.findMany.mockResolvedValue([
      buildComment({
        user: {
          id: "user_2",
          displayName: "",
          firstName: "",
          lastName: "",
          username: "",
          login: "ali_login",
          isVerified: true,
          status: "active",
          plan: "none",
          subscriptionStartedAt: null,
          subscriptionExpiresAt: null,
          slugs: [{ fullSlug: "ALI002" }],
          profileCard: {
            avatarUrl: "",
          },
        },
      }),
    ]);

    const result = await wallService.listPublicWallPosts({
      ownerId: "user_1",
      viewerUserId: "user_3",
    });

    expect(result.items[0]?.comments?.[0]).toMatchObject({
      author: {
        name: "ali_login",
        wallAuthorLabel: "@ali_login",
        verified: true,
        profileHref: "/ALI002",
      },
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

  test("addWallPostComment rejects when comments are disabled on public post", async () => {
    mockPrisma.profileWallPost.findFirst
      .mockResolvedValueOnce(buildPost({ commentsEnabled: false }))
      .mockResolvedValueOnce(buildPost({ commentsEnabled: false }));
    mockPrisma.profileWallPostLike.findMany.mockResolvedValue([]);
    mockPrisma.profileWallPostComment.findMany.mockResolvedValue([]);

    await expect(
      wallService.addWallPostComment({
        ownerId: "user_1",
        postId: "post_1",
        viewerUserId: "user_3",
        content: "Новый комментарий",
      }),
    ).rejects.toMatchObject({
      code: "WALL_POST_NOT_COMMENTABLE",
      message: "Комментарии отключены автором для этого поста",
    });
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

  test("deleteWallPostComment allows owner to delete someone else's comment", async () => {
    mockPrisma.profileWallPost.findFirst
      .mockResolvedValueOnce(buildPost({ commentsEnabled: false }))
      .mockResolvedValueOnce(buildPost({
        commentsEnabled: false,
        _count: { likes: 0 },
      }));
    mockPrisma.profileWallPostComment.findFirst.mockResolvedValue({
      id: "comment_1",
      postId: "post_1",
      userId: "user_2",
    });

    const result = await wallService.deleteWallPostComment({
      ownerId: "user_1",
      postId: "post_1",
      commentId: "comment_1",
      viewerUserId: "user_1",
    });

    expect(mockPrisma.profileWallPostComment.delete).toHaveBeenCalledWith({
      where: {
        id: "comment_1",
      },
    });
    expect(result).toMatchObject({
      id: "post_1",
      commentsCount: 0,
      comments: [],
    });
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
