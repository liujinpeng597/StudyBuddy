import { NextResponse } from "next/server";
import { query } from "@studybuddy/db";
import { generateEmbedding, resolveModelProfile } from "@studybuddy/ai";
import { requireApiUser } from "@/lib/server/auth";
import { errorResponse, jsonError } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

type SearchRow = {
  id: string;
  document_type: "knowledge" | "source" | "leetcode";
  title: string;
  body: string;
  node_id: string | null;
  source_id: string | null;
  resolved_node_id: string | null;
  module_name: string | null;
  updated_at: Date;
};

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    enforceRateLimit(`search:${user.id}`, 90, 60_000);
    const url = new URL(request.url);
    const rawQuery = (url.searchParams.get("q") ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 120);
    if (!rawQuery) return NextResponse.json({ results: [] });
    const escaped = rawQuery.replace(/[\\%_]/g, "\\$&");
    const type = url.searchParams.get("type");
    const moduleId = url.searchParams.get("module");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const result = await query<SearchRow>(
      `SELECT d.id, d.document_type, d.title, d.body, d.node_id, d.source_id,
              COALESCE(d.node_id, (
                SELECT l.node_id FROM source_node_links l
                 WHERE l.source_asset_id = d.source_id AND l.user_id = d.user_id
                 ORDER BY l.created_at DESC LIMIT 1
              )) AS resolved_node_id,
              m.name AS module_name, d.updated_at
         FROM search_documents d
         LEFT JOIN knowledge_nodes n ON n.id = d.node_id
         LEFT JOIN knowledge_modules m ON m.id = n.module_id
        WHERE d.user_id = $1
          AND ($2::text IS NULL OR d.document_type = $2)
          AND ($3::uuid IS NULL OR n.module_id = $3)
          AND ($4::date IS NULL OR d.updated_at >= $4::date)
          AND ($5::date IS NULL OR d.updated_at < ($5::date + interval '1 day'))
          AND (
            d.title ILIKE '%' || $6 || '%' ESCAPE '\\'
            OR d.body ILIKE '%' || $6 || '%' ESCAPE '\\'
            OR similarity(lower(d.title), lower($7)) >= 0.2
          )
        ORDER BY
          CASE WHEN lower(d.title) = lower($7) THEN 0 ELSE 1 END,
          CASE WHEN d.document_type = 'knowledge' THEN 0 ELSE 1 END,
          d.updated_at DESC
        LIMIT 20`,
      [user.id, type, moduleId, from, to, escaped, rawQuery]
    );
    const results: Array<{
      id: string;
      nodeId: string | null;
      title: string;
      snippet: string;
      path: string;
      type: "knowledge" | "source" | "leetcode";
      updatedAt: string | Date;
      semantic: boolean;
    }> = result.rows.map((row) => ({
      id: row.id,
      nodeId: row.resolved_node_id,
      title: row.title,
      snippet: makeSnippet(row.body, rawQuery),
      path: `${row.module_name ?? "知识库"} / ${row.title}`,
      type: row.document_type,
      updatedAt: row.updated_at,
      semantic: false
    }));

    try {
      const profile = await resolveModelProfile(user.id, "embedding");
      const vector = await generateEmbedding(profile, rawQuery);
      const nodes = await query<{ id: string; canonical_title: string; summary: string; embedding: number[] | null; module_name: string | null }>(
        `SELECT n.id, n.canonical_title, n.summary, n.embedding, m.name AS module_name
           FROM knowledge_nodes n
           LEFT JOIN knowledge_modules m ON m.id = n.module_id
          WHERE n.user_id = $1 AND n.embedding IS NOT NULL`,
        [user.id]
      );
      for (const node of nodes.rows) {
        if (!node.embedding) continue;
        const similarity = cosine(vector, node.embedding);
        if (similarity > 0.55 && !results.some((resultItem) => resultItem.nodeId === node.id)) {
          results.push({
            id: `vector-${node.id}`,
            nodeId: node.id,
            title: node.canonical_title,
            snippet: node.summary,
            path: `${node.module_name ?? "知识库"} / ${node.canonical_title}`,
            type: "knowledge",
            updatedAt: new Date().toISOString(),
            semantic: true
          });
        }
      }
    } catch {
      // Exact and fuzzy search remain available without an embedding model.
    }
    return NextResponse.json({ results: results.slice(0, 20) });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    return errorResponse(error);
  }
}

function makeSnippet(body: string, queryText: string) {
  const index = body.toLocaleLowerCase().indexOf(queryText.toLocaleLowerCase());
  const start = Math.max(0, index - 48);
  return body.slice(start, start + 180).replace(/\s+/g, " ");
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
