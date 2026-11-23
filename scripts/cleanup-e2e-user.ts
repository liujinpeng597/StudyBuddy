import "dotenv/config";
import { closePool, query } from "@studybuddy/db";

const result = await query("DELETE FROM users WHERE email = 'test@studybuddy.local'");
console.log(`removed ${result.rowCount} E2E test account(s)`);
await closePool();
