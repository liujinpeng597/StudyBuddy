import { z } from "zod";
import {
  getServerEnv,
  SecretBox,
  type ModelCapability,
  type TaskRole
} from "@studybuddy/core";
import { query } from "@studybuddy/db";

export const AI_PACKAGE_VERSION = 1;

export type ResolvedModelProfile = {
  id: string;
  userId: string;
  displayName: string;
  baseUrl: string;
  modelId: string;
  apiKey: string;
  capabilities: ModelCapability[];
};

type ModelProfileRow = {
  id: string;
  user_id: string;
  display_name: string;
  base_url: string;
  model_id: string;
  api_key_ciphertext: Buffer;
  capabilities: ModelCapability[];
};

export class ModelRoleNotConfiguredError extends Error {
  code = "MODEL_ROLE_NOT_CONFIGURED";

  constructor(role: TaskRole) {
    super(`尚未为 ${role} 配置可用模型`);
  }
}

function secretBox(): SecretBox {
  const env = getServerEnv();
  return new SecretBox(env.SECRET_BOX_ACTIVE_KEY_ID, env.SECRET_BOX_KEYS_JSON);
}

export async function resolveModelProfile(
  userId: string,
  role: TaskRole
): Promise<ResolvedModelProfile> {
  const result = await query<ModelProfileRow>(
    `SELECT p.id, p.user_id, p.display_name, p.base_url, p.model_id,
            p.api_key_ciphertext, p.capabilities
       FROM ai_task_routes r
       JOIN ai_model_profiles p ON p.id = r.profile_id
      WHERE r.user_id = $1 AND r.task_role = $2 AND p.status IN ('available', 'partial')
      ORDER BY r.position ASC
      LIMIT 1`,
    [userId, role]
  );
  const row = result.rows[0];
  if (!row) throw new ModelRoleNotConfiguredError(role);
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

function apiUrl(baseUrl: string, endpoint: "chat/completions" | "embeddings"): string {
  return `${baseUrl.replace(/\/+$/, "")}/${endpoint}`;
}

async function providerRequest(
  profile: ResolvedModelProfile,
  body: Record<string, unknown>,
  endpoint: "chat/completions" | "embeddings" = "chat/completions",
  timeoutMs = 90_000
): Promise<{ data: unknown; latencyMs: number }> {
  const started = Date.now();
  let lastError: Error | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(apiUrl(profile.baseUrl, endpoint), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${profile.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        const rawBody = await response.text();
        let providerMessage = rawBody.slice(0, 1200);
        try {
          const parsed = JSON.parse(rawBody) as { error?: { message?: string } };
          providerMessage = parsed.error?.message ?? providerMessage;
        } catch {
          // Some compatible providers return plain text rather than JSON.
        }
        providerMessage = providerMessage.replaceAll(profile.apiKey, "[REDACTED]");
        const message = `模型接口返回 ${response.status}：${providerMessage || "无错误详情"}`;
        if (retryable && attempt === 0) {
          lastError = new Error(message);
          await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
          continue;
        }
        throw new Error(message);
      }
      return { data: await response.json(), latencyMs: Date.now() - started };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("模型请求失败");
      if (attempt === 0 && !(error instanceof Error && error.name === "AbortError")) {
        await new Promise((resolve) => setTimeout(resolve, 600));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new Error("模型请求失败");
}

function extractJsonText(data: unknown): string {
  const parsed = data as {
    choices?: Array<{ message?: { content?: string | Array<{ text?: string }> } }>;
  };
  const content = parsed.choices?.[0]?.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => part.text ?? "").join("");
  throw new Error("模型未返回文本内容");
}

function parseJson(value: string): unknown {
  const trimmed = value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed);
}

export async function generateJson<T>(
  profile: ResolvedModelProfile,
  schema: z.ZodType<T>,
  options: {
    system: string;
    user: string;
    imageDataUrl?: string;
    maxTokens?: number;
    thinking?: "enabled" | "disabled";
  }
): Promise<T> {
  const userContent = options.imageDataUrl
    ? [
        { type: "text", text: options.user },
        { type: "image_url", image_url: { url: options.imageDataUrl } }
      ]
    : options.user;
  const isDeepSeek = new URL(profile.baseUrl).hostname.endsWith("deepseek.com");
  const { data } = await providerRequest(profile, {
    model: profile.modelId,
    messages: [
      { role: "system", content: options.system },
      { role: "user", content: userContent }
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
    max_tokens: options.maxTokens ?? 3500,
    ...(isDeepSeek ? { thinking: { type: options.thinking ?? "disabled" } } : {})
  });
  const parsed = schema.safeParse(parseJson(extractJsonText(data)));
  if (!parsed.success) {
    throw new Error(`模型输出校验失败: ${parsed.error.issues[0]?.message ?? "未知错误"}`);
  }
  return parsed.data;
}

export async function generateEmbedding(
  profile: ResolvedModelProfile,
  input: string
): Promise<number[]> {
  const { data } = await providerRequest(profile, {
    model: profile.modelId,
    input,
    dimensions: getServerEnv().EMBEDDING_DIMENSIONS
  }, "embeddings", 45_000);
  const vector = (data as { data?: Array<{ embedding?: number[] }> }).data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length !== getServerEnv().EMBEDDING_DIMENSIONS) {
    throw new Error("EMBEDDING_DIMENSION_MISMATCH");
  }
  return vector;
}

export async function testModelProfile(
  profile: ResolvedModelProfile,
  requestedRoles: TaskRole[] = []
): Promise<{
  capabilities: ModelCapability[];
  errors: string[];
}> {
  const capabilities = new Set<ModelCapability>();
  const errors: string[] = [];
  const jsonSchema = z.object({ ok: z.boolean(), label: z.string().min(1) });
  try {
    await generateJson(profile, jsonSchema, {
      system: "只输出 JSON。",
      user: 'Return {"ok":true,"label":"studybuddy"}.',
      maxTokens: 80
    });
    capabilities.add("text");
    capabilities.add("json");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "文本连接测试失败");
    return { capabilities: [...capabilities], errors };
  }
  if (requestedRoles.includes("image_extraction")) {
    try {
      const pixel =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nZkAAAAASUVORK5CYII=";
      await generateJson(
        profile,
        z.object({ ok: z.boolean() }),
        {
          system: "只输出 JSON。",
          user: 'Identify whether an image was supplied. Return {"ok":true}.',
          imageDataUrl: pixel,
          maxTokens: 50
        }
      );
      capabilities.add("vision");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "图片能力测试失败");
    }
  }
  if (requestedRoles.includes("embedding")) {
    try {
      await generateEmbedding(profile, "StudyBuddy embedding capability test");
      capabilities.add("embedding");
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "向量能力测试失败");
    }
  }
  return { capabilities: [...capabilities], errors };
}

const knowledgeGroupResponseSchema = z.object({
  groups: z
    .array(
      z.object({
        module: z.string().trim().min(1).max(80),
        topicPath: z.array(z.string().trim().min(1).max(80)).min(1).max(4),
        groupOrder: z.number().int().min(1).max(1000),
        nodeIds: z.array(z.uuid()).min(1).max(50)
      })
    )
    .min(1)
});

export async function classifyKnowledgeGroups(
  profile: ResolvedModelProfile,
  nodes: Array<{ id: string; title: string; summary: string; currentPath: string[] }>,
  existingGroups: string[][]
) {
  return generateJson(profile, knowledgeGroupResponseSchema, {
    system: `你是个人知识库的分类器，只输出 JSON，不修改知识点正文。
根据概念之间的关系，为每个知识点确定“一级领域 → 二级主题 → 可选子主题”的层级。
同时决定学习顺序：基础命令、基础概念、定义和前置知识必须排在前面，
进阶实现、优化、综合实践排在后面。groupOrder 越小越靠前；
nodeIds 数组也按由浅入深排列。
不要照抄文件标题，也不要把相似但不相同的主题硬合并。
必须优先复用 existingGroups 中已有的分组名称与路径；只有确实不合适时才新增分组。
Linux 示例：管道、共享内存、信号和套接字归入
{"module":"Linux","topicPath":["进程管理","进程间通信"]}；
fork、exec、wait、僵尸进程和进程组归入
{"module":"Linux","topicPath":["进程管理","进程关系"]}。
C++ 示例：虚函数、继承、多态可以归入
{"module":"C++","topicPath":["类与对象","继承与多态"]}。
所有 nodeIds 必须来自输入，每个知识点必须且只能出现一次。
输出结构：
{"groups":[{"module":"领域","topicPath":["主题","子主题"],"groupOrder":1,"nodeIds":["uuid"]}]}`,
    user: JSON.stringify({ existingGroups, nodes }),
    maxTokens: 3500,
    thinking: "disabled"
  });
}
