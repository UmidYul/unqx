const {
  normalizeFreeProfileCode,
  getActivePublicHandle,
  getAllPublicHandles,
  getFreeProfileHandle,
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
});
