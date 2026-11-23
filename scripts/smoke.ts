import "dotenv/config";
import { promises as fs } from "node:fs";
import { HeadBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { getServerEnv } from "@studybuddy/core";
import { closePool, query } from "@studybuddy/db";

async function main() {
  const env = getServerEnv();
  const migration = await query<{ name: string }>(
    "SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 1"
  );
  if (!migration.rows[0]) throw new Error("No migrations applied");
  const modelRoutes = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM ai_task_routes"
  );
  if (env.STORAGE_DRIVER === "local") {
    await fs.access(env.LOCAL_STORAGE_PATH);
  } else {
    if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_BUCKET) {
      throw new Error("S3 storage is not configured");
    }
    const s3 = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY
      }
    });
    await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  }
  const worker = await fetch(env.WORKER_HEALTH_URL);
  if (!worker.ok) throw new Error(`Worker health failed: ${worker.status}`);
  console.log(`database: ok (${migration.rows[0].name})`);
  console.log(`object-store: ok (${env.STORAGE_DRIVER})`);
  console.log("worker: ok");
  console.log(`model-routes: ${modelRoutes.rows[0]?.count ?? "0"}`);
  await closePool();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
