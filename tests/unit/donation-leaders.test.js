const path = require("node:path");
const fs = require("node:fs");
const ejs = require("ejs");

const {
  formatDonationLabel,
  parseDonationAmount,
} = require("../../src/services/donation-leaders");

async function renderUnqxLeadersTemplate(locals = {}) {
  const file = path.join(process.cwd(), "src", "views", "public", "unqx-leaders.ejs");
  return ejs.renderFile(file, {
    title: "UNQX Leaders | UNQX",
    description: "Top 100 донатеров UNQX.",
    image: "/brand/logo.PNG",
    baseUrl: "https://unqx.uz",
    generatedAt: "2026-08-23T10:00:00.000Z",
    items: [],
    ...locals,
  });
}

describe("donation leaders", () => {
  test("parses formatted donation amounts as integer sums", () => {
    expect(parseDonationAmount("100 000 сум")).toBe(100000n);
    expect(parseDonationAmount("1,100,000")).toBe(1100000n);
    expect(parseDonationAmount(250000)).toBe(250000n);
  });

  test("rejects empty and negative donation amounts", () => {
    expect(() => parseDonationAmount("")).toThrow("DONATION_AMOUNT_INVALID");
    expect(() => parseDonationAmount("-1000")).toThrow("DONATION_AMOUNT_INVALID");
    expect(() => parseDonationAmount(-1000n)).toThrow("DONATION_AMOUNT_INVALID");
  });

  test("formats donation totals for UI", () => {
    expect(formatDonationLabel(0n)).toBe("0 сум");
    expect(formatDonationLabel(110000000n)).toBe("110 000 000 сум");
  });

  test("renders UNQX Leaders with top three and compact rows", async () => {
    const html = await renderUnqxLeadersTemplate({
      items: [
        {
          rank: 1,
          name: "Gold User",
          login: "gold",
          avatarUrl: "/a.jpg",
          profileUrl: "/GOL001",
          totalDonationsLabel: "3 000 000 сум",
        },
        {
          rank: 2,
          name: "Silver User",
          login: "silver",
          avatarUrl: "/b.jpg",
          profileUrl: "/SIL002",
          totalDonationsLabel: "2 000 000 сум",
        },
        {
          rank: 3,
          name: "Bronze User",
          login: "bronze",
          avatarUrl: "/c.jpg",
          profileUrl: "/BRO003",
          totalDonationsLabel: "1 500 000 сум",
        },
        {
          rank: 4,
          name: "Fourth User",
          login: "four",
          avatarUrl: "/d.jpg",
          profileUrl: "/FOU004",
          totalDonationsLabel: "900 000 сум",
        },
      ],
    });

    expect(html).toContain("UNQX Leaders");
    expect(html).toContain("Занять своё место");
    expect(html).toContain("/api/leaders/donate");
    expect(html).toContain("#1 · Золото");
    expect(html).toContain("#2 · Серебро");
    expect(html).toContain("#3 · Бронза");
    expect(html).toContain("#4");
    expect(html).toContain("900 000 сум");
    expect(html).toContain('href="/FOU004"');
  });

  test("order approval is wired to automatic donation accumulation", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "src", "services", "order-status-transition.js"), "utf-8");
    expect(source).toContain("addDonationToLeader");
    expect(source).toContain("order:${order.id}:approved");
  });
});
