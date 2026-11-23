import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.url().default("http://localhost:3000"),
  WORKER_HEALTH_URL: z.url().default("http://localhost:3100/health"),
  DATABASE_URL: z.string().min(1),
  TEST_DATABASE_URL: z.string().min(1).optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  LOCAL_STORAGE_PATH: z.string().default("./.data/uploads"),
  S3_ENDPOINT: z.url().optional(),
  S3_PUBLIC_ENDPOINT: z.url().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  S3_FORCE_PATH_STYLE: z
    .string()
    .default("true")
    .transform((value) => value === "true"),
  SECRET_BOX_ACTIVE_KEY_ID: z.string().min(1),
  SECRET_BOX_KEYS_JSON: z.string().min(2),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  SHORT_ANSWER_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.65),
  MAX_AI_EVALUATIONS_PER_DAY: z.coerce.number().int().positive().default(100),
  AI_DAILY_REQUEST_LIMIT: z.coerce.number().int().positive().default(1000),
  AI_DAILY_TOKEN_LIMIT: z.coerce.number().int().positive().default(2_000_000),
  STUDYBUDDY_TEST_MODE: z
    .string()
    .default("false")
    .transform((value) => value === "true")
});

export type ServerEnv = z.infer<typeof envSchema>;

let cachedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cachedEnv) {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
      throw new Error(`Invalid server environment: ${keys}`);
    }
    cachedEnv = parsed.data;
  }
  return cachedEnv;
}
