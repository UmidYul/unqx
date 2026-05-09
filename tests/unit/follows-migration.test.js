const fs = require("node:fs");
const path = require("node:path");

describe("user follows migration", () => {
  test("creates user_follows table and backfills legacy subscriptions", () => {
    const source = fs.readFileSync(path.join(process.cwd(), "migrations", "047_add_user_follows.js"), "utf-8");

    expect(source).toContain("CREATE TABLE IF NOT EXISTS user_follows");
    expect(source).toContain("UNIQUE(follower_id, followee_id)");
    expect(source).toContain("contact_user_id");
    expect(source).toContain("LEFT JOIN slugs s");
    expect(source).toContain("ON CONFLICT (follower_id, followee_id) DO NOTHING");
  });
});
