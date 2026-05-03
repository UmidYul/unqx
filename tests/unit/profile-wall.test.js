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
        $queryRaw: vi.fn().mockResolvedValue(undefined),
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

  test("addWallPostLike rejects self-like", async () => {
    mockPrisma.profileWallPost.findFirst.mockResolvedValue({
      id: "post_1",
      ownerId: "user_1",
      content: "Тест",
      status: "published",
      createdAt: new Date("2026-05-03T10:00:00.000Z"),
      updatedAt: new Date("2026-05-03T10:00:00.000Z"),
      hiddenAt: null,
      deletedAt: null,
      _count: { likes: 0 },
    });

    await expect(
      wallService.addWallPostLike({
        ownerId: "user_1",
        postId: "post_1",
        viewerUserId: "user_1",
      }),
    ).rejects.toMatchObject({ code: "WALL_POST_SELF_LIKE_FORBIDDEN" });

    expect(mockPrisma.profileWallPostLike.create).not.toHaveBeenCalled();
  });
});
