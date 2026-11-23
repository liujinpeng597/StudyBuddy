import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  assertSafeModelUrl,
  getServerEnv,
  maskSecret,
  SecretBox,
  taskRoleSchema,
  type ModelCapability,
  type TaskRole
} from "@studybuddy/core";
import { query } from "@studybuddy/db";
import {
  testModelProfile,
  type ResolvedModelProfile
} from "@studybuddy/ai";
import { withUserTransaction } from "@studybuddy/db";

type ProfileRow = {
  id: string;
  user_id: string;
  display_name: string;
  provider_type: string;
  base_url: string;
  model_id: string;
  api_key_hint: string;
  capabilities: ModelCapability[];
  requested_roles: TaskRole[];
  status: string;
  last_tested_at: Date | null;
  created_at: Date;
};

export const profileInputSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  baseUrl: z.string().trim().min(1).max(2048),
  modelId: z.string().trim().min(1).max(200),
  apiKey: z.string().min(1).max(4096).optional(),
  capabilities: z.array(z.enum(["text", "json", "vision", "embedding"])).min(1),
  roles: z.array(taskRoleSchema).min(1).max(6)
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

function secretBox(): SecretBox {
  const env = getServerEnv();
  return new SecretBox(env.SECRET_BOX_ACTIVE_KEY_ID, env.SECRET_BOX_KEYS_JSON);
}

export function toPublicProfile(row: ProfileRow) {
  return {
    id: row.id,
    displayName: row.display_name,
    providerType: row.provider_type,
    baseUrl: row.base_url,
    modelId: row.model_id,
    apiKeyHint: row.api_key_hint,
    capabilities: row.capabilities,
    roles: row.requested_roles,
    status: row.status,
    lastTestedAt: row.last_tested_at,
    createdAt: row.created_at
  };
}

export async function listProfiles(userId: string) {
  const result = await query<ProfileRow>(
    `SELECT p.id, p.user_id, p.display_name, p.provider_type, p.base_url, p.model_id,
            p.api_key_hint, p.capabilities, p.requested_roles, p.status, p.last_tested_at, p.created_at
       FROM ai_model_profiles p
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC`,
    [userId]
  );
  return result.rows.map(toPublicProfile);
}

async function prepareProfile(input: ProfileInput, id: string): Promise<ResolvedModelProfile> {
  const env = getServerEnv();
  const safeUrl = await assertSafeModelUrl(input.baseUrl, env.STUDYBUDDY_TEST_MODE);
  if (!input.apiKey) throw new Error("API Key 不能为空");
  return {
    id,
    userId: "",
    displayName: input.displayName,
    baseUrl: safeUrl.toString().replace(/\/$/, ""),
    modelId: input.modelId,
    apiKey: input.apiKey,
    capabilities: []
  };
}

export async function createProfile(userId: string, input: ProfileInput) {
  const id = randomUUID();
  if (!input.apiKey) throw new Error("API Key 不能为空");
  const apiKey = input.apiKey;
  const profile = await prepareProfile(input, id);
  const encrypted = secretBox().encrypt(apiKey, id);
  await withUserTransaction(userId, async (client) => {
    await client.query(
      `INSERT INTO ai_model_profiles
         (id, user_id, display_name, base_url, model_id, api_key_ciphertext, api_key_hint,
          capabilities, requested_roles, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, '{}', $8, 'untested')`,
      [
        id,
        userId,
        input.displayName,
        profile.baseUrl,
        input.modelId,
        encrypted,
        maskSecret(apiKey),
        input.roles
      ]
    );
  });
  return getProfileRow(userId, id);
}

export async function updateProfile(userId: string, id: string, input: ProfileInput) {
  const existing = await getProfileRow(userId, id);
  const profile = await prepareProfile({ ...input, apiKey: input.apiKey ?? "unchanged" }, id);
  await withUserTransaction(userId, async (client) => {
    if (input.apiKey) {
      const encrypted = secretBox().encrypt(input.apiKey, id);
      await client.query(
        `UPDATE ai_model_profiles
            SET display_name = $3, base_url = $4, model_id = $5, api_key_ciphertext = $6,
                api_key_hint = $7, requested_roles = $8, status = 'untested', updated_at = now()
          WHERE user_id = $1 AND id = $2`,
        [
          userId,
          id,
          input.displayName,
          profile.baseUrl,
          input.modelId,
          encrypted,
          maskSecret(input.apiKey),
          input.roles
        ]
      );
    } else {
      await client.query(
        `UPDATE ai_model_profiles
            SET display_name = $3, base_url = $4, model_id = $5, requested_roles = $6,
                status = 'untested', updated_at = now()
          WHERE user_id = $1 AND id = $2`,
        [userId, id, input.displayName, profile.baseUrl, input.modelId, input.roles]
      );
    }
  });
  return existing;
}

export async function getProfileRow(userId: string, id: string): Promise<ProfileRow> {
  const result = await query<ProfileRow>(
    `SELECT id, user_id, display_name, provider_type, base_url, model_id, api_key_hint,
            capabilities, requested_roles, status, last_tested_at, created_at
       FROM ai_model_profiles
      WHERE user_id = $1 AND id = $2`,
    [userId, id]
  );
  const row = result.rows[0];
  if (!row) throw new Error("模型配置不存在");
  return row;
}

export async function testProfile(userId: string, id: string) {
  const row = await getProfileRow(userId, id);
  const resolved = await resolveModelProfileById(userId, id);
  const result = await testModelProfile(resolved, row.requested_roles);
  const required = new Map<TaskRole, ModelCapability>([
    ["normalization", "json"],
    ["merge_judgement", "json"],
    ["question_generation", "json"],
    ["answer_evaluation", "json"],
    ["image_extraction", "vision"],
    ["embedding", "embedding"]
  ]);
  const passedRoles = row.requested_roles.filter((role) => {
    const capability = required.get(role);
    return capability ? result.capabilities.includes(capability) : false;
  });
  const status =
    passedRoles.length === 0
      ? "failed"
      : passedRoles.length === row.requested_roles.length
        ? "available"
        : "partial";
  await withUserTransaction(userId, async (client) => {
    await client.query(
      `UPDATE ai_model_profiles
          SET capabilities = $3, status = $4, last_tested_at = now(), updated_at = now()
        WHERE user_id = $1 AND id = $2`,
      [userId, id, result.capabilities, status]
    );
    await client.query("DELETE FROM ai_task_routes WHERE user_id = $1 AND profile_id = $2", [
      userId,
      id
    ]);
    for (const role of passedRoles) {
      await client.query(
        `INSERT INTO ai_task_routes (user_id, task_role, position, profile_id)
         VALUES ($1, $2, 0, $3)
         ON CONFLICT (user_id, task_role, position)
         DO UPDATE SET profile_id = EXCLUDED.profile_id`,
        [userId, role, id]
      );
    }
  });
  return { status, capabilities: result.capabilities, errors: result.errors };
}

export async function resolveModelProfileById(
  userId: string,
  id: string
): Promise<ResolvedModelProfile> {
  const result = await query<{
    id: string;
    user_id: string;
    display_name: string;
    base_url: string;
    model_id: string;
    api_key_ciphertext: Buffer;
    capabilities: ModelCapability[];
  }>(
    `SELECT id, user_id, display_name, base_url, model_id, api_key_ciphertext, capabilities
       FROM ai_model_profiles
      WHERE user_id = $1 AND id = $2`,
    [userId, id]
  );
  const row = result.rows[0];
  if (!row) throw new Error("模型配置不存在");
  return {
    id: row.id,
    userId: row.user_id,
    displayName: row.display_name,
    baseUrl: row.base_url,
    modelId: row.model_id,
    apiKey: secretBox().decrypt(Buffer.from(row.api_key_ciphertext), row.id),
    capabilities: row.capabilities
  };
}
