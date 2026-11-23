import { NextResponse } from "next/server";
import { generateEmbedding, resolveModelProfile } from "@studybuddy/ai";
import { query } from "@studybuddy/db";
import { requireApiUser } from "@/lib/server/auth";
import { errorResponse, jsonError } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

type ModuleRow = {
  id: string;
  parent_id: string | null;
  name: string;
};

type NodeRow = {
  id: string;
  title: string;
  summary: string;
  module_id: string | null;
  embedding: number[] | null;
};

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    enforceRateLimit(`graph-suggestions:${user.id}`, 30, 60_000);
    const nodeId = new URL(request.url).searchParams.get("nodeId");
    if (!nodeId) return jsonError("缺少知识点参数");
    const [nodes, modules] = await Promise.all([
      query<NodeRow>(
        `SELECT id, canonical_title AS title, summary, module_id, embedding
           FROM knowledge_nodes
          WHERE user_id = $1`,
        [user.id]
      ),
      query<ModuleRow>(
        "SELECT id, parent_id, name FROM knowledge_modules WHERE user_id = $1",
        [user.id]
      )
    ]);
    const source = nodes.rows.find((node) => node.id === nodeId);
    if (!source) return jsonError("知识点不存在", 404);

    try {
      if (!source.embedding) {
        const profile = await resolveModelProfile(user.id, "embedding");
        source.embedding = await generateEmbedding(
          profile,
          `${source.title}\n${source.summary}`
        );
        await query(
          "UPDATE knowledge_nodes SET embedding = $3 WHERE user_id = $1 AND id = $2",
          [user.id, source.id, JSON.stringify(source.embedding)]
        );
      }
    } catch {
      return NextResponse.json({
        suggestions: [],
        reason: "需要先在模型设置中接入支持语义向量的模型。"
      });
    }

    const paths = buildModulePaths(modules.rows);
    const sourcePath = paths.get(source.module_id ?? "") ?? ["未分类"];
    const suggestions = nodes.rows
      .filter((node) => node.id !== source.id && node.embedding)
      .map((node) => {
        const path = paths.get(node.module_id ?? "") ?? ["未分类"];
        return {
          id: node.id,
          title: node.title,
          summary: node.summary,
          path: path.join(" / "),
          similarity: cosine(source.embedding!, node.embedding!),
          crossBranch: path[0] !== sourcePath[0] || node.module_id !== source.module_id
        };
      })
      .filter((node) => node.crossBranch && node.similarity >= 0.42)
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, 5)
      .map((node) => ({ ...node, similarity: Number(node.similarity.toFixed(3)) }));
    return NextResponse.json({ suggestions });
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

function cosine(left: number[], right: number[]) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    dot += left[index]! * right[index]!;
    leftNorm += left[index]! ** 2;
    rightNorm += right[index]! ** 2;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm) || 1);
}
