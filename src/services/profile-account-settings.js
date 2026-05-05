const { normalizeLogin, isValidLogin } = require("../utils/login");

const PROFILE_LOGIN_INVALID_MESSAGE = "Логин может содержать только латиницу, цифры и символы . _ -";
const PROFILE_LOGIN_TAKEN_MESSAGE = "Этот логин уже занят";

function createProfileSettingsError(message, code, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

async function resolveProfileSettingsLoginUpdate({
  viewerUserId = "",
  currentLogin = "",
  requestedLogin,
  hasRequestedLogin = false,
  findUserByLogin = async () => null,
} = {}) {
  const normalizedCurrentLogin = normalizeLogin(currentLogin);
  if (!hasRequestedLogin) {
    return {
      shouldUpdate: false,
      login: normalizedCurrentLogin || null,
    };
  }

  const normalizedRequestedLogin = normalizeLogin(requestedLogin);
  if (!normalizedRequestedLogin) {
    return {
      shouldUpdate: false,
      login: normalizedCurrentLogin || null,
    };
  }

  if (normalizedRequestedLogin === normalizedCurrentLogin) {
    return {
      shouldUpdate: false,
      login: normalizedCurrentLogin || normalizedRequestedLogin,
    };
  }

  if (!isValidLogin(normalizedRequestedLogin)) {
    throw createProfileSettingsError(PROFILE_LOGIN_INVALID_MESSAGE, "LOGIN_INVALID", 400);
  }

  const existingUser = await findUserByLogin(normalizedRequestedLogin);
  const normalizedViewerUserId = String(viewerUserId || "").trim();
  const existingUserId = String(existingUser?.id || "").trim();
  if (existingUserId && existingUserId !== normalizedViewerUserId) {
    throw createProfileSettingsError(PROFILE_LOGIN_TAKEN_MESSAGE, "LOGIN_TAKEN", 409);
  }

  return {
    shouldUpdate: true,
    login: normalizedRequestedLogin,
  };
}

function applyProfileSettingsSessionUser(sessionUser, updatedUser) {
  if (!sessionUser || typeof sessionUser !== "object" || !updatedUser || typeof updatedUser !== "object") {
    return sessionUser;
  }

  return {
    ...sessionUser,
    login: updatedUser.login || null,
    username: updatedUser.login || updatedUser.username || sessionUser.username || null,
    telegramUsername: updatedUser.telegramUsername || sessionUser.telegramUsername || null,
    city: updatedUser.city || null,
    displayName: updatedUser.displayName || sessionUser.displayName || null,
  };
}

function buildProfileSettingsUserPayload(updatedUser) {
  return {
    displayName: updatedUser?.displayName || "",
    city: updatedUser?.city || "",
    notificationsEnabled: Boolean(updatedUser?.notificationsEnabled),
    showInDirectory: Boolean(updatedUser?.showInDirectory),
    login: updatedUser?.login || "",
    username: updatedUser?.login || updatedUser?.username || "",
    telegramUsername: updatedUser?.telegramUsername || "",
  };
}

module.exports = {
  PROFILE_LOGIN_INVALID_MESSAGE,
  PROFILE_LOGIN_TAKEN_MESSAGE,
  applyProfileSettingsSessionUser,
  buildProfileSettingsUserPayload,
  resolveProfileSettingsLoginUpdate,
};
