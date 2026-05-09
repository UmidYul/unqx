const prismaModulePath = require.resolve("../../src/db/prisma");
const pushModulePath = require.resolve("../../src/services/push");
const subscriptionModulePath = require.resolve("../../src/services/subscription");
const followsModulePath = require.resolve("../../src/services/follows");

const mockPrisma = {
  slug: {
    findUnique: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  userFollow: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  $executeRaw: vi.fn(),
};

require.cache[prismaModulePath] = {
  id: prismaModulePath,
  filename: prismaModulePath,
  loaded: true,
  exports: { prisma: mockPrisma },
};

require.cache[pushModulePath] = {
  id: pushModulePath,
  filename: pushModulePath,
  loaded: true,
  exports: {
    sendFollowPushNotification: vi.fn().mockResolvedValue({ ok: true }),
  },
};

require.cache[subscriptionModulePath] = {
  id: subscriptionModulePath,
  filename: subscriptionModulePath,
  loaded: true,
  exports: {
    isPublicProfileVisible: (user) => user?.status === "active" && user?.isVisible !== false,
  },
};

delete require.cache[followsModulePath];
const followsService = require("../../src/services/follows");

function buildUser(overrides = {}) {
  return {
    id: "user_2",
    status: "active",
    isVisible: true,
    plan: "premium",
    subscriptionStartedAt: new Date("2026-05-01T00:00:00.000Z"),
    subscriptionExpiresAt: new Date("2026-06-01T00:00:00.000Z"),
    displayName: "User Two",
    firstName: "User",
    lastName: "Two",
    username: "user_two",
    login: "user.two",
    isVerified: true,
    verifiedCompany: "UNQX",
    profileCard: {
      name: "User Two",
      role: "Designer",
      avatarUrl: "/uploads/user-two.webp",
    },
    slugs: [{ fullSlug: "TWO222" }],
    ...overrides,
  };
}

describe("follows service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.slug.findUnique.mockReset();
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.userFollow.findMany.mockReset();
    mockPrisma.userFollow.count.mockReset();
    mockPrisma.userFollow.create.mockReset();
    mockPrisma.userFollow.deleteMany.mockReset();
    mockPrisma.$executeRaw.mockReset();
    mockPrisma.slug.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(buildUser({ id: "user_1", slugs: [{ fullSlug: "ONE111" }] }));
    mockPrisma.userFollow.findMany.mockResolvedValue([]);
    mockPrisma.userFollow.count.mockResolvedValue(0);
    mockPrisma.userFollow.create.mockResolvedValue({ id: "follow_1" });
    mockPrisma.userFollow.deleteMany.mockResolvedValue({ count: 1 });
    mockPrisma.$executeRaw.mockResolvedValue(1);
  });

  test("followUserBySlug creates social follow and returns summary", async () => {
    mockPrisma.slug.findUnique.mockResolvedValue({
      fullSlug: "TWO222",
      status: "active",
      ownerId: "user_2",
      owner: buildUser(),
    });
    mockPrisma.userFollow.findMany
      .mockResolvedValueOnce([{ followeeId: "user_2" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.userFollow.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const result = await followsService.followUserBySlug({
      slug: "two222",
      followerUserId: "user_1",
    });

    expect(mockPrisma.userFollow.create).toHaveBeenCalledWith({
      data: {
        followerId: "user_1",
        followeeId: "user_2",
      },
    });
    expect(result).toMatchObject({
      ok: true,
      followed: true,
      summary: {
        counts: {
          followers: 1,
          following: 0,
        },
        viewer: {
          isFollowing: true,
          canFollow: true,
        },
      },
    });
    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
  });

  test("followUserBySlug rejects self follow", async () => {
    mockPrisma.slug.findUnique.mockResolvedValue({
      fullSlug: "ONE111",
      status: "active",
      ownerId: "user_1",
      owner: buildUser({ id: "user_1", slugs: [{ fullSlug: "ONE111" }] }),
    });

    await expect(
      followsService.followUserBySlug({
        slug: "ONE111",
        followerUserId: "user_1",
      }),
    ).rejects.toMatchObject({ code: "FOLLOW_SELF_FORBIDDEN" });
  });

  test("listFollowItemsByOwner public scope hides unavailable profiles and exposes follow flags", async () => {
    mockPrisma.userFollow.findMany
      .mockResolvedValueOnce([
        {
          id: "follow_1",
          createdAt: new Date("2026-05-09T08:00:00.000Z"),
          followee: buildUser({
            id: "user_visible",
            displayName: "Visible User",
            slugs: [{ fullSlug: "VIS123" }],
          }),
        },
        {
          id: "follow_2",
          createdAt: new Date("2026-05-09T07:00:00.000Z"),
          followee: buildUser({
            id: "user_hidden",
            displayName: "Hidden User",
            isVisible: false,
            slugs: [{ fullSlug: "HID123" }],
          }),
        },
      ])
      .mockResolvedValueOnce([{ followeeId: "user_visible" }]);

    const result = await followsService.listFollowItemsByOwner({
      ownerId: "user_1",
      type: "following",
      viewerUserId: "viewer_1",
      scope: "public",
      page: 1,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      userId: "user_visible",
      primarySlug: "VIS123",
      isFollowing: true,
      canFollow: true,
      isPubliclyReachable: true,
    });
  });
});
