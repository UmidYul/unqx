const {
  compareSlugs,
  getNextSlug,
  getSlugStorageParts,
  isAssignableSlug,
  isLegacySlug,
  isManagedUsernameSlug,
  isReservedSlugPath,
  isValidSlug,
  slugToSequence,
} = require("../../src/services/slug");

describe("slug helpers", () => {
  it("validates format", () => {
    expect(isValidSlug("AAA001")).toBe(true);
    expect(isLegacySlug("AAA001")).toBe(true);
    expect(isValidSlug("aaA001")).toBe(false);
    expect(isValidSlug("AAA01")).toBe(false);
  });

  it("validates admin-assignable username slugs", () => {
    ["0", "1", "999", "A", "XXX", "AAA001"].forEach((slug) => {
      expect(isAssignableSlug(slug)).toBe(true);
    });
    ["0", "1", "999", "A", "XXX"].forEach((slug) => {
      expect(isManagedUsernameSlug(slug)).toBe(true);
    });
  });

  it("rejects invalid and reserved username slugs", () => {
    ["001", "1000", "A1", "ABCD", "API", "QR", "FAQ", "ADMIN", "MANAGER"].forEach((slug) => {
      expect(isAssignableSlug(slug)).toBe(false);
    });
    ["API", "QR", "FAQ", "ADMIN", "MANAGER"].forEach((slug) => {
      expect(isReservedSlugPath(slug)).toBe(true);
    });
  });

  it("maps assignable slugs to storage parts", () => {
    expect(getSlugStorageParts("AAA001")).toEqual({ letters: "AAA", digits: "001" });
    expect(getSlugStorageParts("A")).toEqual({ letters: "A", digits: "" });
    expect(getSlugStorageParts("999")).toEqual({ letters: "", digits: "999" });
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
