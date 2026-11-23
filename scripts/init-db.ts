import "dotenv/config";
import pg from "pg";

const { Client } = pg;

function databaseName(urlValue: string): string {
  return new URL(urlValue).pathname.replace(/^\//, "");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const parsed = new URL(url);
  const target = `${databaseName(url)}_test`;
  parsed.pathname = "/postgres";
  const client = new Client({ connectionString: parsed.toString() });
  await client.connect();
  try {
    const exists = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [target]);
    if (!exists.rowCount) {
      await client.query(`CREATE DATABASE "${target.replaceAll('"', '""')}"`);
      console.log(`created ${target}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
