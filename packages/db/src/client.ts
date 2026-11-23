import pg from "pg";
import { getServerEnv } from "@studybuddy/core";

const { Pool } = pg;

type GlobalWithPool = typeof globalThis & {
  __studybuddyPool?: pg.Pool;
};

export function getPool(): pg.Pool {
  const globalPool = globalThis as GlobalWithPool;
  if (!globalPool.__studybuddyPool) {
    globalPool.__studybuddyPool = new Pool({
      connectionString: getServerEnv().DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000
    });
  }
  return globalPool.__studybuddyPool;
}

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  values: unknown[] = []
): Promise<pg.QueryResult<T>> {
  return getPool().query<T>(sql, values);
}

export async function withTransaction<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function withUserTransaction<T>(
  userId: string,
  fn: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  return withTransaction(async (client) => {
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId]);
    return fn(client);
  });
}

export async function closePool(): Promise<void> {
  const globalPool = globalThis as GlobalWithPool;
  if (globalPool.__studybuddyPool) {
    await globalPool.__studybuddyPool.end();
    delete globalPool.__studybuddyPool;
  }
}
