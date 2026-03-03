const { requireCsrfToken } = require("../../src/middleware/csrf");

function createReq({ method = "GET", session = {}, headers = {}, body = {}, originalUrl = "/api/admin/cards" } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value]),
  );

  return {
    method,
    session,
    body,
    originalUrl,
    get(name) {
      return normalizedHeaders[String(name).toLowerCase()] || null;
    },
  };
}

function createRes() {
  return {
    statusCode: 200,
    jsonBody: null,
    renderedView: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    },
    render(view) {
      this.renderedView = view;
      return this;
    },
  };
}

describe("csrf middleware", () => {
  test("skips CSRF check for GET requests", () => {
    const req = createReq({ method: "GET", session: null });
    const res = createRes();
    const next = vi.fn();

    requireCsrfToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  test("rejects POST request without token", () => {
    const req = createReq({ method: "POST", session: {} });
    const res = createRes();
    const next = vi.fn();

    requireCsrfToken(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toEqual({ error: "Invalid CSRF token" });
  });

  test("passes POST request with matching token", () => {
    const token = "a".repeat(64);
    const req = createReq({
      method: "POST",
      session: { csrfToken: token },
      headers: { "x-csrf-token": token },
    });
    const res = createRes();
    const next = vi.fn();

    requireCsrfToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });
});
