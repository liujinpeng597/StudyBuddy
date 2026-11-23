import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hashPassword } from "@studybuddy/core";
import { query } from "@studybuddy/db";

async function main() {
  let email = process.env.STUDYBUDDY_AUTH_EMAIL;
  let password = process.env.STUDYBUDDY_AUTH_PASSWORD;
  if (!email || !password) {
    const prompt = createInterface({ input: stdin, output: stdout });
    email ||= (await prompt.question("Email: ")).trim();
    password ||= await prompt.question("Password: ");
    prompt.close();
  }
  if (!email || !password) throw new Error("Email and password are required");
  const passwordHash = await hashPassword(password);
  await query(
    `INSERT INTO users (email, password_hash)
     VALUES (lower($1), $2)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()`,
    [email, passwordHash]
  );
  console.log(`user ready: ${email.toLowerCase()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
