import { NextResponse } from "next/server";
import { query, withUserTransaction } from "@studybuddy/db";
import { requireApiUser } from "@/lib/server/auth";
import { errorResponse, jsonError } from "@/lib/server/http";

type NodeRow = {
  id: string;
  canonical_title: string;
  summary: string;
  module_name: string | null;
  module_id: string | null;
  x: number | null;
  y: number | null;
  changed: boolean;
  review_status: string;
};

type EdgeRow = {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  confidence: number;
  origin: string;
  review_status: string;
};

export async function GET() {
  try {
    const user = await requireApiUser();
    const [nodes, edges] = await Promise.all([
      query<NodeRow>(
        `SELECT n.id, n.canonical_title, n.summary, m.name AS module_name, n.module_id,
                l.x, l.y, n.review_status,
                EXISTS (
                  SELECT 1 FROM knowledge_revisions r
                   WHERE r.node_id = n.id AND r.job_id = (
                     SELECT id FROM import_jobs
                      WHERE user_id = $1 AND status = 'completed'
                      ORDER BY finished_at DESC NULLS LAST LIMIT 1
                   )
                ) AS changed
           FROM knowledge_nodes n
           LEFT JOIN knowledge_modules m ON m.id = n.module_id
           LEFT JOIN graph_layout l ON l.node_id = n.id AND l.user_id = n.user_id
          WHERE n.user_id = $1
          ORDER BY n.canonical_title`,
        [user.id]
      ),
      query<EdgeRow>(
        `SELECT id, source_id, target_id, type, confidence::float8, origin, review_status
           FROM knowledge_relations
          WHERE user_id = $1
          ORDER BY created_at`,
        [user.id]
      )
    ]);
    const moduleNames = [...new Set(nodes.rows.map((node) => node.module_name ?? "未分类"))];
    const missing = nodes.rows
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => node.x === null || node.y === null);
    if (missing.length) {
      const positions = missing.map(({ node, index }) => {
        const moduleIndex = Math.max(0, moduleNames.indexOf(node.module_name ?? "未分类"));
        const angle = index * 2.399963229728653;
        const radius = 130 + (index % 9) * 54;
        return {
          id: node.id,
          x: (moduleIndex % 3) * 520 + Math.cos(angle) * radius,
          y: Math.floor(moduleIndex / 3) * 480 + Math.sin(angle) * radius,
          cluster: node.module_name ?? "未分类"
        };
      });
      await withUserTransaction(user.id, async (client) => {
        for (const position of positions) {
          await client.query(
            `INSERT INTO graph_layout (user_id, node_id, x, y, cluster_key)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, node_id) DO UPDATE
             SET x = EXCLUDED.x, y = EXCLUDED.y, cluster_key = EXCLUDED.cluster_key`,
            [user.id, position.id, position.x, position.y, position.cluster]
          );
        }
      });
      for (const { node } of missing) {
        const position = positions.find((item) => item.id === node.id);
        node.x = position?.x ?? 0;
        node.y = position?.y ?? 0;
      }
    }
    return NextResponse.json({
      nodes: nodes.rows.map((node) => ({
        id: node.id,
        title: node.canonical_title,
        summary: node.summary,
        module: node.module_name ?? "未分类",
        x: node.x ?? 0,
        y: node.y ?? 0,
        changed: node.changed,
        needsReview: node.review_status === "needs_review"
      })),
      edges: edges.rows.map((edge) => ({
        id: edge.id,
        source: edge.source_id,
        target: edge.target_id,
        type: edge.type,
        confidence: edge.confidence,
        origin: edge.origin,
        needsReview: edge.review_status === "needs_review"
      }))
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    return errorResponse(error);
  }
}
