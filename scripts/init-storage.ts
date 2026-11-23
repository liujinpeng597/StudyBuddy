import "dotenv/config";
import { promises as fs } from "node:fs";
import {
  CreateBucketCommand,
  HeadBucketCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getServerEnv } from "@studybuddy/core";

async function main() {
  const env = getServerEnv();
  if (env.STORAGE_DRIVER === "local") {
    await fs.mkdir(env.LOCAL_STORAGE_PATH, { recursive: true });
    console.log(`storage ready: ${env.LOCAL_STORAGE_PATH}`);
    return;
  }
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY || !env.S3_BUCKET) {
    throw new Error("S3 storage requires S3_ENDPOINT, credentials and S3_BUCKET");
  }
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY
    }
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
  }
  console.log(`bucket ready: ${env.S3_BUCKET}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
