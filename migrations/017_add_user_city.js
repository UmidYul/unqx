module.exports = {
    id: "017_add_user_city",
    async up(client) {
        await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS city VARCHAR(120);
    `);
    },
};
