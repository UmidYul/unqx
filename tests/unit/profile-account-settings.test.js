const {
  applyProfileSettingsSessionUser,
  buildProfileSettingsUserPayload,
  resolveProfileSettingsLoginUpdate,
} = require("../../src/services/profile-account-settings");

describe("profile account settings", () => {
  test("user without login can save a valid free login", async () => {
    const result = await resolveProfileSettingsLoginUpdate({
      viewerUserId: "user_1",
      currentLogin: "",
      requestedLogin: "  New.Login  ",
      hasRequestedLogin: true,
      findUserByLogin: async () => null,
    });

    expect(result).toEqual({
      shouldUpdate: true,
      login: "new.login",
    });
  });

  test("user with existing login can replace it through profile settings", async () => {
    const result = await resolveProfileSettingsLoginUpdate({
      viewerUserId: "user_1",
      currentLogin: "locked_login",
      requestedLogin: "another_login",
      hasRequestedLogin: true,
      findUserByLogin: async () => null,
    });

    expect(result).toEqual({
      shouldUpdate: true,
      login: "another_login",
    });
  });

  test("keeping the same login is treated as a no-op", async () => {
    const result = await resolveProfileSettingsLoginUpdate({
      viewerUserId: "user_1",
      currentLogin: "same_login",
      requestedLogin: "same_login",
      hasRequestedLogin: true,
      findUserByLogin: async () => ({ id: "user_1" }),
    });

    expect(result).toEqual({
      shouldUpdate: false,
      login: "same_login",
    });
  });

  test("invalid login is rejected", async () => {
    await expect(
      resolveProfileSettingsLoginUpdate({
        viewerUserId: "user_1",
        currentLogin: "",
        requestedLogin: "inv lid",
        hasRequestedLogin: true,
        findUserByLogin: async () => null,
      }),
    ).rejects.toMatchObject({
      code: "LOGIN_INVALID",
      message: "Логин может содержать только латиницу, цифры и символы . _ -",
    });
  });

  test("taken login is rejected", async () => {
    await expect(
      resolveProfileSettingsLoginUpdate({
        viewerUserId: "user_1",
        currentLogin: "",
        requestedLogin: "busy_login",
        hasRequestedLogin: true,
        findUserByLogin: async () => ({ id: "user_2" }),
      }),
    ).rejects.toMatchObject({
      code: "LOGIN_TAKEN",
      message: "Этот логин уже занят",
    });
  });

  test("successful save payload includes login and session payload is updated", () => {
    const updatedUser = {
      login: "new_login",
      displayName: "Ali",
      city: "Tashkent",
      notificationsEnabled: true,
      showInDirectory: false,
    };

    expect(buildProfileSettingsUserPayload(updatedUser)).toMatchObject({
      login: "new_login",
      displayName: "Ali",
      city: "Tashkent",
      notificationsEnabled: true,
      showInDirectory: false,
    });

    expect(
      applyProfileSettingsSessionUser(
        {
          userId: "user_1",
          login: null,
          displayName: "Old Name",
          city: null,
          username: "ali",
        },
        updatedUser,
      ),
    ).toMatchObject({
      userId: "user_1",
      login: "new_login",
      displayName: "Ali",
      city: "Tashkent",
      username: "ali",
    });
  });
});
