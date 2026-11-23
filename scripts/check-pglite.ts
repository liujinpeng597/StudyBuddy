import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const db = new PGlite({ extensions: { pgcrypto, pg_trgm } });
await db.waitReady;
try {
  await db.exec("CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS pgcrypto;");
  const result = await db.query<{ value: string }>("SELECT similarity('知识网络', '知识图谱')::text AS value");
  console.log(result.rows[0]?.value);
} finally {
  await db.close();
}
