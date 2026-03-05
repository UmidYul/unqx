const fs = require("fs");
const { Client } = require("pg");

const client = new Client({
    host: "127.0.0.200",
    port: 5432,
    user: "unqxuz_umid",
    password: "U!6OjoqfP=Y4T_J8",
    database: "unqxuz_DB"
});

async function runSQL() {
    try {
        await client.connect();
        console.log("✅ Connected to PostgreSQL");

        const sql = fs.readFileSync("./migration_cleanup.sql", "utf8");

        await client.query(sql);

        console.log("✅ SQL executed successfully");
    } catch (err) {
        console.error("❌ Error executing SQL:", err.message);
    } finally {
        await client.end();
    }
}

runSQL();