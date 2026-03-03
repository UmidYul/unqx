const { generateVCard } = require("../../src/services/vcard");

describe("generateVCard", () => {
  it("builds valid vcard payload", () => {
    const card = generateVCard({
      name: "John Doe",
      phone: "+123",
      email: "john@example.com",
      extraPhone: "+456",
      address: "Main st",
      postcode: "1000",
      hashtag: "#tag",
    });

    expect(card).toContain("BEGIN:VCARD");
    expect(card).toContain("FN:John Doe");
    expect(card).toContain("TEL;TYPE=CELL:+123");
    expect(card).toContain("EMAIL:john@example.com");
    expect(card).toContain("END:VCARD");
  });
});
