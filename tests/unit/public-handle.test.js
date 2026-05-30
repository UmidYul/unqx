const bcrypt = require("bcryptjs");

process.env.NODE_ENV = "test";
process.env.ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync("test-password", 10);

const {
  normalizeFreeProfileCode,
  getActivePublicHandle,
  getAllPublicHandles,
  getFreeProfileHandle,
  ensureProfileCardExists,
} = require("../../src/services/public-handle");

describe("public handle helpers", () => {
  test("normalizes valid free profile code and rejects leading zero", () => {
    expect(normalizeFreeProfileCode("1234-5678-9012")).toBe("123456789012");
    expect(normalizeFreeProfileCode("023456789012")).toBe("");
  });

  test("returns free handle when user has no paid slug", () => {
    const handle = getActivePublicHandle({
      freeProfileCode: "123456789012",
      freeProfileStatus: "private",
      freeProfilePauseMessage: "Hidden",
      freeProfileDisabledAt: null,
      slugs: [],
    });

    expect(handle).toEqual({
      type: "free",
      value: "123456789012",
      href: "/123456789012",
      status: "private",
      pauseMessage: "Hidden",
      isPrimary: true,
    });
  });

  test("prefers paid slug over free handle when both exist", () => {
    const handle = getActivePublicHandle({
      freeProfileCode: "123456789012",
      freeProfileStatus: "active",
      freeProfileDisabledAt: null,
      slugs: [
        {
          fullSlug: "ABC123",
          status: "active",
          pauseMessage: null,
          isPrimary: true,
        },
      ],
    });

    expect(handle).toMatchObject({
      type: "slug",
      value: "ABC123",
      href: "/ABC123",
      status: "active",
      isPrimary: true,
    });
  });

  test("free handle disappears after disable and paid handles stay linkable", () => {
    expect(
      getFreeProfileHandle({
        freeProfileCode: "123456789012",
        freeProfileStatus: "active",
        freeProfileDisabledAt: new Date("2026-05-19T00:00:00.000Z"),
      }),
    ).toBeNull();

    expect(
      getAllPublicHandles({
        freeProfileCode: "123456789012",
        freeProfileStatus: "active",
        freeProfileDisabledAt: null,
        slugs: [
          {
            fullSlug: "ABC123",
            status: "active",
            pauseMessage: null,
            isPrimary: true,
          },
          {
            fullSlug: "XYZ999",
            status: "paused",
            pauseMessage: "Break",
            isPrimary: false,
          },
        ],
      }),
    ).toEqual([
      {
        type: "slug",
        value: "ABC123",
        href: "/ABC123",
        status: "active",
        pauseMessage: null,
        isPrimary: true,
      },
      {
        type: "slug",
        value: "XYZ999",
        href: "/XYZ999",
        status: "paused",
        pauseMessage: "Break",
        isPrimary: false,
      },
    ]);
  });

  test("falls back to compat profile card insert when Prisma enum type mismatches", async () => {
    const tx = {
      profileCard: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue({
          message: 'column "theme" is of type cardtheme but expression is of type "CardTheme"',
        }),
      },
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ id: "card-123" }]),
    };

    const created = await ensureProfileCardExists({
      tx,
      user: {
        id: "69e6e274-2480-44fb-9eb5-df04ef16465f",
        firstName: "Ali",
      },
    });

    expect(created).toEqual({ id: "card-123" });
    expect(tx.profileCard.create).toHaveBeenCalledTimes(1);
    expect(tx.$queryRawUnsafe).toHaveBeenCalledTimes(1);

    const [query, ownerId, name, tags, buttons, showBranding] = tx.$queryRawUnsafe.mock.calls[0];
    expect(query).toContain("INSERT INTO profile_cards");
    expect(query).not.toContain("theme");
    expect(ownerId).toBe("69e6e274-2480-44fb-9eb5-df04ef16465f");
    expect(name).toBe("Ali");
    expect(tags).toBe("[]");
    expect(buttons).toBe("[]");
    expect(showBranding).toBe(true);
  });
});
