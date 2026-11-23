import "dotenv/config";
import { SecretBox, getServerEnv } from "@studybuddy/core";
import { query, withTransaction } from "@studybuddy/db";

async function main() {
  const apply = process.argv.includes("--apply");
  const env = getServerEnv();
  const box = new SecretBox(env.SECRET_BOX_ACTIVE_KEY_ID, env.SECRET_BOX_KEYS_JSON);
  const profiles = await query<{ id: string; api_key_ciphertext: Buffer }>(
    "SELECT id, api_key_ciphertext FROM ai_model_profiles ORDER BY id"
  );
  if (!apply) {
    console.log(`dry run: ${profiles.rowCount} model keys would be re-encrypted`);
    return;
  }
  await withTransaction(async (client) => {
    for (const profile of profiles.rows) {
      const plaintext = box.decrypt(Buffer.from(profile.api_key_ciphertext), profile.id);
      const encrypted = box.encrypt(plaintext, profile.id);
      await client.query(
        "UPDATE ai_model_profiles SET api_key_ciphertext = $2, updated_at = now() WHERE id = $1",
        [profile.id, encrypted]
      );
    }
  });
  console.log(`re-encrypted ${profiles.rowCount} model keys with ${env.SECRET_BOX_ACTIVE_KEY_ID}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
