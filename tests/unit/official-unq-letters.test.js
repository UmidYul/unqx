const { isOfficialUnqLetters, isOfficialUnqSlug } = require("../../src/constants/official-unq-letters");

describe("official unq letters", () => {
  it("detects reserved letter prefixes case-insensitively", () => {
    expect(isOfficialUnqLetters("DAV")).toBe(true);
    expect(isOfficialUnqLetters("dav")).toBe(true);
    expect(isOfficialUnqLetters("Uzb")).toBe(true);
    expect(isOfficialUnqLetters("AAA")).toBe(false);
  });

  it("detects slug by first three letters only", () => {
    expect(isOfficialUnqSlug("DAV101")).toBe(true);
    expect(isOfficialUnqSlug("dav999")).toBe(true);
    expect(isOfficialUnqSlug("AAA101")).toBe(false);
    expect(isOfficialUnqSlug("DAV10")).toBe(false);
  });
});
