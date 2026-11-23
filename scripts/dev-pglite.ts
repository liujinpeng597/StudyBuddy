import "dotenv/config";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { createServer } from "pglite-server";

const port = Number(process.env.PGLITE_PORT ?? "5432");
const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", `pglite-${port}`);

const db = new PGlite(dataDir, {
  extensions: { pgcrypto, pg_trgm }
});
await db.waitReady;
await db.exec(`
  CREATE EXTENSION IF NOT EXISTS pgcrypto;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
`);

const server = createServer(db);
server.listen(port, () => {
  console.log(`PGlite ready on postgres://localhost:${port}/postgres (${dataDir})`);
});

async function shutdown() {
  server.close();
  await db.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
