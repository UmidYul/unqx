const { detectDevice } = require("../../src/services/ua");

describe("detectDevice", () => {
  it("returns mobile for mobile UA", () => {
    expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1")).toBe(
      "mobile",
    );
  });

  it("returns desktop for desktop UA", () => {
    expect(detectDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")).toBe("desktop");
  });

  it("falls back to desktop for empty UA", () => {
    expect(detectDevice(undefined)).toBe("desktop");
  });
});
