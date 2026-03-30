const { prisma } = require("../../db/prisma");
const { randomSlug } = require("../../services/drops");

// Возвращает случайный свободный slug в формате AAA000
async function getRandomFreeSlug(req, res) {
    let attempt = 0;
    let slug;
    let found = false;
    while (attempt < 20 && !found) {
        slug = randomSlug();
        // Проверяем, что slug свободен
        const row = await prisma.slug.findUnique({ where: { fullSlug: slug } });
        if (!row || row.status === "free") {
            found = true;
            break;
        }
        attempt++;
    }
    if (found) {
        res.json({ slug });
    } else {
        res.status(404).json({ error: "Нет свободных slug" });
    }
}

module.exports = { getRandomFreeSlug };