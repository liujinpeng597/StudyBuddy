import dotenv from "dotenv";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { createServer } from "pglite-server";
import { migrate } from "@studybuddy/db";

export default async function setup() {
  dotenv.config({ path: ".env.test", override: true });
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const developmentUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("TEST_DATABASE_URL is required");
  if (databaseUrl === developmentUrl) {
    throw new Error("Refusing to run integration tests against the development database");
  }
  const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
  await db.waitReady;
  await db.exec(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
  `);
  const server = createServer(db);
  await new Promise<void>((resolve) => server.listen(55432, "127.0.0.1", resolve));
  process.env.DATABASE_URL = databaseUrl;
  await migrate(databaseUrl);
  return async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.close();
  };
}
