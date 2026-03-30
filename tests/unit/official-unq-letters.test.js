const {
  normalizeOfficialUnqPrefixes,
  isOfficialUnqSlugWithPrefixes,
} = require("../../src/services/official-unq-config");

describe("official unq config", () => {
  it("normalizes letter prefixes", () => {
    expect(normalizeOfficialUnqPrefixes(["DAV", "dav", "  uzb "])).toEqual(["DAV", "UZB"]);
    expect(normalizeOfficialUnqPrefixes([])).toEqual(["DAV", "PPP", "PAA", "UZB"]);
  });

  it("detects slug by configured prefixes", () => {
    expect(isOfficialUnqSlugWithPrefixes("DAV101", ["DAV"])).toBe(true);
    expect(isOfficialUnqSlugWithPrefixes("dav999", ["DAV"])).toBe(true);
    expect(isOfficialUnqSlugWithPrefixes("AAA101", ["DAV"])).toBe(false);
  });
});
