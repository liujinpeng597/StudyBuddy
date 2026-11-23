import dotenv from "dotenv";

dotenv.config({ path: ".env.test", override: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) throw new Error("TEST_DATABASE_URL is required");
process.env.DATABASE_URL = testDatabaseUrl;
