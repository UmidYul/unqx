const { detectDevice } = require("../../src/services/ua");

describe("detectDevice", () => {
  it("returns ios for iPhone UA", () => {
    expect(detectDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1")).toBe(
      "ios",
    );
  });

  it("returns android for android UA", () => {
    expect(detectDevice("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36")).toBe(
      "android",
    );
  });

  it("returns desktop for desktop UA", () => {
    expect(detectDevice("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")).toBe("desktop");
  });

  it("falls back to desktop for empty UA", () => {
    expect(detectDevice(undefined)).toBe("desktop");
  });
});
