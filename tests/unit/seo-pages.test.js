const path = require("node:path");
const ejs = require("ejs");

async function renderSeoHubTemplate() {
  const file = path.join(process.cwd(), "src", "views", "public", "seo-hub.ejs");
  return ejs.renderFile(file, {
    title: "Гайды и FAQ по цифровым визиткам | UNQX",
    description: "Полные гайды UNQX",
    heading: "Гайды UNQX",
    lead: "Сильные материалы",
    image: "https://unqx.uz/brand/logo.PNG",
    jsonLd: [],
    cards: [
      { href: "/guides/digital-business-card", title: "Гайд", description: "Описание" },
      { href: "/faq", title: "FAQ", description: "Ответы" },
    ],
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/guides",
    cspNonce: "nonce",
    csrfToken: "csrf",
  });
}

async function renderSeoPageTemplate() {
  const file = path.join(process.cwd(), "src", "views", "public", "seo-page.ejs");
  return ejs.renderFile(file, {
    title: "Гайд",
    description: "Описание гайда",
    heading: "Заголовок",
    lead: "Вводный текст",
    image: "https://unqx.uz/brand/logo.PNG",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
      },
    ],
    sections: [
      {
        title: "Раздел",
        paragraphs: ["Первый абзац"],
        bullets: ["Пункт 1", "Пункт 2"],
      },
    ],
    faqs: [{ question: "Вопрос?", answer: "Ответ." }],
    readingMinutes: 10,
    updatedAt: "2026-03-05",
    baseUrl: "https://unqx.uz",
    canonicalUrl: "https://unqx.uz/guides/demo",
    cspNonce: "nonce",
    csrfToken: "csrf",
  });
}

describe("seo pages", () => {
  test("renders seo hub page with internal links", async () => {
    const html = await renderSeoHubTemplate();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Гайды UNQX");
    expect(html).toContain('href="/guides/digital-business-card"');
    expect(html).toContain('href="/faq"');
  });

  test("renders seo article page with faq section", async () => {
    const html = await renderSeoPageTemplate();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("FAQ");
    expect(html).toContain("Вопрос?");
    expect(html).toContain('application/ld+json');
  });
});

