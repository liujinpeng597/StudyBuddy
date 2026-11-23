import { promises as fs } from "node:fs";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getServerEnv } from "@studybuddy/core";

export const STORAGE_PACKAGE_VERSION = 1;

function localRoot(): string {
  return path.resolve(getServerEnv().LOCAL_STORAGE_PATH);
}

function localPath(key: string): string {
  const root = localRoot();
  const target = path.resolve(root, key);
  if (!target.startsWith(`${root}${path.sep}`) && target !== root) {
    throw new Error("Invalid storage key");
  }
  return target;
}

function s3Client(): S3Client {
  const env = getServerEnv();
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error("S3 storage is selected but not configured");
  }
  return new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY
    }
  });
}

export function makeSourceKey(userId: string, jobId: string, assetId: string, fileName: string) {
  return path.posix.join("users", userId, "imports", jobId, assetId, fileName);
}

export async function putSource(key: string, bytes: Buffer, contentType: string): Promise<void> {
  const env = getServerEnv();
  if (env.STORAGE_DRIVER === "local") {
    const filePath = localPath(key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, bytes);
    return;
  }
  if (!env.S3_BUCKET) throw new Error("S3_BUCKET is required");
  await s3Client().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: contentType
    })
  );
}

export async function getSource(key: string): Promise<Buffer> {
  const env = getServerEnv();
  if (env.STORAGE_DRIVER === "local") {
    return fs.readFile(localPath(key));
  }
  if (!env.S3_BUCKET) throw new Error("S3_BUCKET is required");
  const response = await s3Client().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  if (!response.Body) throw new Error("Stored object has no body");
  return Buffer.from(await response.Body.transformToByteArray());
}

export async function deleteSource(key: string): Promise<void> {
  const env = getServerEnv();
  if (env.STORAGE_DRIVER === "local") {
    await fs.rm(localPath(key), { force: true });
    return;
  }
  if (!env.S3_BUCKET) throw new Error("S3_BUCKET is required");
  await s3Client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
}

export async function sourceReadUrl(key: string): Promise<string | null> {
  const env = getServerEnv();
  if (env.STORAGE_DRIVER === "local") return null;
  if (!env.S3_BUCKET) throw new Error("S3_BUCKET is required");
  return getSignedUrl(s3Client(), new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
    expiresIn: 600
  });
}
