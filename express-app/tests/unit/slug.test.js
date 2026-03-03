const { compareSlugs, getNextSlug, isValidSlug, slugToSequence } = require("../../src/services/slug");

describe("slug helpers", () => {
  it("validates format", () => {
    expect(isValidSlug("AAA001")).toBe(true);
    expect(isValidSlug("aaA001")).toBe(false);
    expect(isValidSlug("AAA01")).toBe(false);
  });

  it("returns first slug when current is null", () => {
    expect(getNextSlug(null)).toBe("AAA001");
  });

  it("increments numeric suffix", () => {
    expect(getNextSlug("AAA001")).toBe("AAA002");
  });

  it("rolls over prefix", () => {
    expect(getNextSlug("AAA999")).toBe("AAB001");
  });

  it("compares slug order", () => {
    expect(compareSlugs("AAA010", "AAA009")).toBeGreaterThan(0);
    expect(slugToSequence("AAB001")).toBeGreaterThan(slugToSequence("AAA999"));
  });
});
