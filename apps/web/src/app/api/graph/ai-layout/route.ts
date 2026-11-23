import { NextResponse } from "next/server";
import { z } from "zod";
import { generateJson, resolveModelProfile } from "@studybuddy/ai";
import { query } from "@studybuddy/db";
import { requireApiUser } from "@/lib/server/auth";
import { assertSameOrigin, errorResponse, jsonError } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

type ModuleRow = {
  id: string;
  parent_id: string | null;
  name: string;
};

const difficultySchema = z.object({
  nodes: z
    .array(
      z.object({
        id: z.uuid(),
        difficulty: z.number().int().min(1).max(3)
      })
    )
    .min(1)
    .max(80)
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    enforceRateLimit(`graph-ai-layout:${user.id}`, 8, 60 * 60_000);
    const [nodes, modules] = await Promise.all([
      query<{ id: string; title: string; summary: string; module_id: string | null }>(
        `SELECT id, canonical_title AS title, summary, module_id
           FROM knowledge_nodes
          WHERE user_id = $1
          ORDER BY canonical_title`,
        [user.id]
      ),
      query<ModuleRow>(
        "SELECT id, parent_id, name FROM knowledge_modules WHERE user_id = $1",
        [user.id]
      )
    ]);
    if (!nodes.rows.length) return NextResponse.json({ positions: {}, difficulties: {} });
    if (nodes.rows.length > 80) return jsonError("AI 排版单次最多支持 80 个知识点");

    const profile = await resolveModelProfile(user.id, "merge_judgement");
    const classified = await generateJson(profile, difficultySchema, {
      system: `你是知识图谱学习难度分类器，只输出 JSON。
将每个知识点按理解门槛分为三档：
1 = 基础概念、定义、基本命令或前置知识；
2 = 进阶机制、实现原理、综合应用；
3 = 高级优化、底层细节、复杂场景或容易混淆的深入内容。
所有 id 必须来自输入且只能出现一次。不要输出解释。
输出：{"nodes":[{"id":"uuid","difficulty":1}]}`,
      user: JSON.stringify(
        nodes.rows.map((node) => ({
          id: node.id,
          title: node.title,
          summary: node.summary
        }))
      ),
      maxTokens: 2400,
      thinking: "disabled"
    });

    const difficultyById = new Map(
      classified.nodes.map((node) => [node.id, node.difficulty])
    );
    for (const node of nodes.rows) {
      if (!difficultyById.has(node.id)) difficultyById.set(node.id, 2);
    }

    const paths = buildModulePaths(modules.rows);
    const groups = new Map<string, typeof nodes.rows>();
    for (const node of nodes.rows) {
      const path = paths.get(node.module_id ?? "") ?? ["未分类"];
      const key = path.join(" / ");
      groups.set(key, [...(groups.get(key) ?? []), node]);
    }
    const columns = Math.max(1, Math.ceil(Math.sqrt(groups.size)));
    const positions: Record<string, { x: number; y: number }> = {};
    [...groups.entries()].forEach(([, groupNodes], groupIndex) => {
      const centerX = 420 + (groupIndex % columns) * 720;
      const centerY = 320 + Math.floor(groupIndex / columns) * 660;
      const ordered = [...groupNodes].sort(
        (left, right) =>
          (difficultyById.get(left.id) ?? 2) - (difficultyById.get(right.id) ?? 2) ||
          left.title.localeCompare(right.title, "zh-CN")
      );
      ordered.forEach((node, nodeIndex) => {
        const difficulty = difficultyById.get(node.id) ?? 2;
        const radius = 105 + difficulty * 78 + (nodeIndex % 3) * 16;
        const angle = nodeIndex * 2.399963229728653;
        positions[node.id] = {
          x: Math.round(centerX + Math.cos(angle) * radius),
          y: Math.round(centerY + Math.sin(angle) * radius)
        };
      });
    });
    return NextResponse.json({
      positions,
      difficulties: Object.fromEntries(difficultyById)
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function buildModulePaths(rows: ModuleRow[]) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const paths = new Map<string, string[]>();
  function resolve(id: string | null): string[] {
    if (!id) return [];
    const cached = paths.get(id);
    if (cached) return cached;
    const row = byId.get(id);
    if (!row) return [];
    const path = [...resolve(row.parent_id), row.name];
    paths.set(id, path);
    return path;
  }
  for (const row of rows) resolve(row.id);
  return paths;
}
