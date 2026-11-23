import "dotenv/config";
import { promises as fs } from "node:fs";
import path from "node:path";
import pg from "pg";

const { Pool } = pg;

export async function migrate(connectionString = process.env.DATABASE_URL): Promise<void> {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const migrationsDir = path.join(import.meta.dirname, "..", "migrations");
  const files = (await fs.readdir(migrationsDir)).filter((file) => file.endsWith(".sql")).sort();
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    for (const file of files) {
      const already = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
      if (already.rowCount) continue;
      const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
        await client.query("COMMIT");
        process.stdout.write(`applied ${file}\n`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  } finally {
    await pool.end();
  }
}

if (process.argv[1]?.replaceAll("\\", "/").endsWith("migrate.ts")) {
  migrate().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
