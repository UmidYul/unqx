const { requireSameOrigin } = require("../../src/middleware/same-origin");

function createReq({ method = "POST", headers = {}, protocol = "https" } = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [String(key).toLowerCase(), value]),
  );

  return {
    method,
    protocol,
    get(name) {
      return normalizedHeaders[String(name).toLowerCase()] || null;
    },
  };
}

function createRes() {
  return {
    statusCode: 200,
    jsonBody: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.jsonBody = payload;
      return this;
    },
  };
}

describe("same-origin middleware", () => {
  test("allows www alias for the same host", () => {
    const req = createReq({
      headers: {
        host: "unqx.uz",
        "x-forwarded-proto": "https",
        origin: "https://www.unqx.uz",
        referer: "https://www.unqx.uz/login",
      },
    });
    const res = createRes();
    const next = vi.fn();

    requireSameOrigin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  test("allows POST request when origin/referer match request host", () => {
    const req = createReq({
      headers: {
        host: "m.unqx.uz",
        "x-forwarded-proto": "https",
        origin: "https://m.unqx.uz",
        referer: "https://m.unqx.uz/login",
      },
    });
    const res = createRes();
    const next = vi.fn();

    requireSameOrigin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  test("allows opaque origin values used by some mobile webviews", () => {
    const req = createReq({
      headers: {
        host: "unqx.uz",
        "x-forwarded-proto": "https",
        origin: "null",
      },
    });
    const res = createRes();
    const next = vi.fn();

    requireSameOrigin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
  });

  test("rejects POST request when origin does not match allowed origins", () => {
    const req = createReq({
      headers: {
        host: "unqx.uz",
        "x-forwarded-proto": "https",
        origin: "https://evil.example",
      },
    });
    const res = createRes();
    const next = vi.fn();

    requireSameOrigin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.jsonBody).toEqual({ error: "Forbidden" });
  });
});
