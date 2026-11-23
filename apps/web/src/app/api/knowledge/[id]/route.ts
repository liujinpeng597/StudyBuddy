import { NextResponse } from "next/server";
import { query } from "@studybuddy/db";
import { sourceReadUrl } from "@studybuddy/storage";
import { requireApiUser } from "@/lib/server/auth";
import { errorResponse, jsonError } from "@/lib/server/http";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireApiUser();
    const { id } = await context.params;
    const node = await query<{
      id: string;
      canonical_title: string;
      summary: string;
      sections: Record<string, string>;
      aliases: string[];
      review_status: string;
      created_at: Date;
      updated_at: Date;
      module_name: string | null;
      module_id: string | null;
    }>(
      `SELECT n.id, n.canonical_title, n.summary, n.sections, n.aliases, n.review_status,
              n.created_at, n.updated_at, n.module_id, m.name AS module_name
         FROM knowledge_nodes n
         LEFT JOIN knowledge_modules m ON m.id = n.module_id
        WHERE n.id = $1 AND n.user_id = $2`,
      [id, user.id]
    );
    if (!node.rows[0]) return jsonError("知识点不存在", 404);
    const [relations, sources, problems, modules] = await Promise.all([
      query(
        `SELECT r.type, r.confidence::float8, r.review_status,
                CASE WHEN r.source_id = $1 THEN r.target_id ELSE r.source_id END AS node_id,
                CASE WHEN r.source_id = $1 THEN n2.canonical_title ELSE n1.canonical_title END AS title,
                CASE WHEN r.source_id = $1 THEN n2.summary ELSE n1.summary END AS summary,
                CASE WHEN r.source_id = $1 THEN 'out' ELSE 'in' END AS direction
           FROM knowledge_relations r
           JOIN knowledge_nodes n1 ON n1.id = r.source_id
           JOIN knowledge_nodes n2 ON n2.id = r.target_id
          WHERE r.user_id = $2 AND ($1 = r.source_id OR $1 = r.target_id)`,
        [id, user.id]
      ),
      query<{
        id: string;
        file_name: string;
        type: string;
        source_excerpt: string;
        question_text: string | null;
        storage_path: string;
        mime_type: string;
      }>(
        `SELECT s.id, s.file_name, s.type, l.source_excerpt, l.question_text,
                s.storage_path, s.mime_type
           FROM source_node_links l
           JOIN source_assets s ON s.id = l.source_asset_id
          WHERE l.node_id = $1 AND l.user_id = $2
          ORDER BY l.created_at DESC`,
        [id, user.id]
      ),
      query(
        `SELECT p.id, p.title, p.number, p.description, p.code, p.language,
                p.data_structures, p.algorithms, p.complexity, p.optimization_notes,
                p.inferred_fields, p.incomplete_fields
           FROM leetcode_problems p
           JOIN problem_node_links l ON l.problem_id = p.id
          WHERE l.node_id = $1 AND p.user_id = $2`,
        [id, user.id]
      ),
      query<{ id: string; parent_id: string | null; name: string }>(
        "SELECT id, parent_id, name FROM knowledge_modules WHERE user_id = $1",
        [user.id]
      )
    ]);
    const modulePaths = buildModulePaths(modules.rows);
    const sourceRows = await Promise.all(
      sources.rows.map(async (source) => ({
        id: source.id,
        fileName: source.file_name,
        type: source.type,
        excerpt: source.source_excerpt,
        question: source.question_text,
        imageUrl:
          source.type === "image"
            ? (await sourceReadUrl(source.storage_path)) ?? `/api/source-assets/${source.id}`
            : null
      }))
    );
    await query(
      `UPDATE search_documents SET last_accessed_at = now()
        WHERE user_id = $1 AND node_id = $2`,
      [user.id, id]
    );
    return NextResponse.json({
      node: {
        ...node.rows[0],
        module_path: modulePaths.get(node.rows[0].module_id ?? "") ?? [
          node.rows[0].module_name ?? "未分类"
        ]
      },
      relations: relations.rows,
      sources: sourceRows,
      problems: problems.rows
    });
  } catch (error) {
    return errorResponse(error);
  }
}

function buildModulePaths(rows: Array<{ id: string; parent_id: string | null; name: string }>) {
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
