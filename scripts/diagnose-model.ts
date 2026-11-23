import "dotenv/config";
import { getServerEnv, SecretBox } from "@studybuddy/core";
import { closePool, query } from "@studybuddy/db";

type ProfileRow = {
  id: string;
  display_name: string;
  base_url: string;
  model_id: string;
  api_key_ciphertext: Buffer;
  capabilities: string[];
  requested_roles: string[];
};

const env = getServerEnv();
const box = new SecretBox(env.SECRET_BOX_ACTIVE_KEY_ID, env.SECRET_BOX_KEYS_JSON);
const profiles = await query<ProfileRow>(
  `SELECT id, display_name, base_url, model_id, api_key_ciphertext, capabilities, requested_roles
     FROM ai_model_profiles
    ORDER BY created_at DESC`
);

for (const profile of profiles.rows) {
  const modelId = process.env.MODEL_ID_OVERRIDE ?? profile.model_id;
  const apiKey = box.decrypt(Buffer.from(profile.api_key_ciphertext), profile.id);
  const endpoint = `${profile.base_url.replace(/\/+$/, "")}/chat/completions`;
  console.log(`\n${profile.display_name}`);
  console.log(`Base URL: ${profile.base_url}`);
  console.log(`Model ID: ${modelId}${process.env.MODEL_ID_OVERRIDE ? " (override)" : ""}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Roles: ${profile.requested_roles.join(", ") || "none"}`);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: "Return JSON only." },
          { role: "user", content: 'Return {"ok":true}.' }
        ],
        response_format: { type: "json_object" },
        ...(new URL(profile.base_url).hostname.endsWith("deepseek.com")
          ? { thinking: { type: "disabled" } }
          : {}),
        max_tokens: 30
      }),
      signal: AbortSignal.timeout(30_000)
    });
    const text = await response.text();
    const safeText = text.replaceAll(apiKey, "[REDACTED]").slice(0, 1200);
    console.log(`HTTP: ${response.status}`);
    console.log(`Response: ${safeText || "(empty)"}`);
  } catch (error) {
    console.log(`Network error: ${error instanceof Error ? error.message : "unknown"}`);
  }
}

await closePool();
