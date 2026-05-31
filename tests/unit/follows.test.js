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
    findFirst: vi.fn(),
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
    slugs: [{ fullSlug: "TWO222", status: "active", isPrimary: true }],
    ...overrides,
  };
}

describe("follows service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.slug.findUnique.mockReset();
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.user.findFirst.mockReset();
    mockPrisma.userFollow.findMany.mockReset();
    mockPrisma.userFollow.count.mockReset();
    mockPrisma.userFollow.create.mockReset();
    mockPrisma.userFollow.deleteMany.mockReset();
    mockPrisma.$executeRaw.mockReset();
    mockPrisma.slug.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(buildUser({ id: "user_1", slugs: [{ fullSlug: "ONE111", status: "active", isPrimary: true }] }));
    mockPrisma.user.findFirst.mockResolvedValue(null);
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
      owner: buildUser({ id: "user_1", slugs: [{ fullSlug: "ONE111", status: "active", isPrimary: true }] }),
    });

    await expect(
      followsService.followUserBySlug({
        slug: "ONE111",
        followerUserId: "user_1",
      }),
    ).rejects.toMatchObject({ code: "FOLLOW_SELF_FORBIDDEN" });
  });

  test("followUserBySlug supports free profile handles", async () => {
    mockPrisma.slug.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(
      buildUser({
        id: "user_free",
        slugs: [],
        freeProfileCode: "123456789012",
        freeProfileStatus: "active",
        freeProfileDisabledAt: null,
      }),
    );
    mockPrisma.userFollow.findMany
      .mockResolvedValueOnce([{ followeeId: "user_free" }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockPrisma.userFollow.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);

    const result = await followsService.followUserBySlug({
      slug: "123456789012",
      followerUserId: "user_1",
    });

    expect(mockPrisma.user.findFirst).toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: true,
      followed: true,
      summary: {
        counts: {
          followers: 1,
          following: 0,
        },
      },
    });
  });

  test("listFollowItemsByOwner public scope keeps unavailable profiles with safe flags", async () => {
    mockPrisma.userFollow.findMany
      .mockResolvedValueOnce([
        {
          id: "follow_1",
          createdAt: new Date("2026-05-09T08:00:00.000Z"),
          followee: buildUser({
            id: "user_visible",
            displayName: "Visible User",
            slugs: [{ fullSlug: "VIS123", status: "active", isPrimary: true }],
          }),
        },
        {
          id: "follow_2",
          createdAt: new Date("2026-05-09T07:00:00.000Z"),
          followee: buildUser({
            id: "user_hidden",
            displayName: "Hidden User",
            isVisible: false,
            slugs: [{ fullSlug: "HID123", status: "active", isPrimary: true }],
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

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({
      userId: "user_visible",
      primarySlug: "VIS123",
      isFollowing: true,
      canFollow: true,
      isPubliclyReachable: true,
    });
    expect(result.items[1]).toMatchObject({
      userId: "user_hidden",
      primarySlug: "HID123",
      isFollowing: false,
      canFollow: false,
      isPubliclyReachable: false,
      profileHref: null,
    });
  });

  test("listFollowItemsByOwner public scope reports exact total and hasMore for a full last page", async () => {
    const visibleRows = Array.from({ length: 20 }, (_, index) => ({
      id: `follow_${index + 1}`,
      createdAt: new Date(`2026-05-${String((index % 9) + 1).padStart(2, "0")}T08:00:00.000Z`),
      followee: buildUser({
        id: `user_visible_${index + 1}`,
        displayName: `Visible User ${index + 1}`,
        slugs: [{ fullSlug: `VIS${String(index + 1).padStart(3, "0")}`, status: "active", isPrimary: true }],
      }),
    }));
    mockPrisma.userFollow.findMany
      .mockResolvedValueOnce(visibleRows)
      .mockResolvedValueOnce([]);

    const result = await followsService.listFollowItemsByOwner({
      ownerId: "user_1",
      type: "following",
      viewerUserId: "viewer_1",
      scope: "public",
      page: 1,
      pageSize: 20,
    });

    expect(result.items).toHaveLength(20);
    expect(result.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 20,
      hasMore: false,
    });
  });

  test("getFollowSummaryForOwner public scope keeps real counts and includes unavailable preview items safely", async () => {
    const followerRows = [
      {
        id: "follow_follower_1",
        createdAt: new Date("2026-05-09T08:00:00.000Z"),
        follower: buildUser({
          id: "user_visible_follower",
          displayName: "Visible Follower",
          slugs: [{ fullSlug: "VF123", status: "active", isPrimary: true }],
        }),
      },
      {
        id: "follow_follower_2",
        createdAt: new Date("2026-05-09T07:00:00.000Z"),
        follower: buildUser({
          id: "user_hidden_follower",
          displayName: "Hidden Follower",
          isVisible: false,
          slugs: [{ fullSlug: "HF123", status: "active", isPrimary: true }],
        }),
      },
    ];
    const followingRows = [
      {
        id: "follow_following_1",
        createdAt: new Date("2026-05-08T08:00:00.000Z"),
        followee: buildUser({
          id: "user_visible_following",
          displayName: "Visible Following",
          slugs: [{ fullSlug: "VG123", status: "active", isPrimary: true }],
        }),
      },
      {
        id: "follow_following_2",
        createdAt: new Date("2026-05-08T07:00:00.000Z"),
        followee: buildUser({
          id: "user_hidden_following",
          displayName: "Hidden Following",
          isVisible: false,
          slugs: [{ fullSlug: "HG123", status: "active", isPrimary: true }],
        }),
      },
    ];

    mockPrisma.userFollow.findMany.mockImplementation(async (args = {}) => {
      if (args?.select?.followeeId) {
        const followeeIds = args?.where?.followeeId?.in || [];
        if (followeeIds.includes("user_2")) {
          return [{ followeeId: "user_2" }];
        }
        return [];
      }
      if (args?.select?.follower) {
        return followerRows;
      }
      if (args?.select?.followee) {
        return followingRows;
      }
      return [];
    });
    mockPrisma.userFollow.count.mockImplementation(async (args = {}) => {
      if (args?.where?.followeeId === "user_2") {
        return 2;
      }
      if (args?.where?.followerId === "user_2") {
        return 2;
      }
      return 0;
    });

    const summary = await followsService.getFollowSummaryForOwner({
      ownerId: "user_2",
      viewerUserId: "user_1",
      scope: "public",
    });

    expect(summary).toMatchObject({
      counts: {
        followers: 2,
        following: 2,
      },
      viewer: {
        isFollowing: true,
        canFollow: true,
        requiresAuth: false,
      },
    });
    expect(summary.previews.following).toHaveLength(2);
    expect(summary.previews.following[0]).toMatchObject({
      userId: "user_visible_following",
      primarySlug: "VG123",
      isPubliclyReachable: true,
    });
    expect(summary.previews.following[1]).toMatchObject({
      userId: "user_hidden_following",
      primarySlug: "HG123",
      isPubliclyReachable: false,
      profileHref: null,
      canFollow: false,
    });
  });
});
