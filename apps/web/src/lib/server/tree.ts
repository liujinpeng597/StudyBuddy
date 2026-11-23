import type {
  DisplayPreferences,
  KnowledgeTreeNode,
  KnowledgeTreePayload
} from "@studybuddy/core";
import { query } from "@studybuddy/db";

type ModuleRow = {
  id: string;
  parent_id: string | null;
  kind: string;
  name: string;
};

type NodeRow = {
  id: string;
  module_id: string | null;
  canonical_title: string;
  review_status: string;
  changed: boolean;
};

export async function getKnowledgeTree(userId: string): Promise<KnowledgeTreePayload> {
  const [modules, nodes] = await Promise.all([
    query<ModuleRow>(
      "SELECT id, parent_id, kind, name FROM knowledge_modules WHERE user_id = $1 ORDER BY sort_order, name",
      [userId]
    ),
    query<NodeRow>(
      `SELECT n.id, n.module_id, n.canonical_title, n.review_status,
              EXISTS (
                SELECT 1
                  FROM knowledge_revisions r
                  JOIN import_jobs j ON j.id = r.job_id
                 WHERE r.node_id = n.id AND j.user_id = $1
                   AND j.status = 'completed'
                   AND j.id = (
                     SELECT id FROM import_jobs
                      WHERE user_id = $1 AND status = 'completed'
                      ORDER BY finished_at DESC NULLS LAST
                      LIMIT 1
                   )
              ) AS changed
         FROM knowledge_nodes n
        WHERE n.user_id = $1
        ORDER BY n.study_order, n.canonical_title`,
      [userId]
    )
  ]);
  const childrenByParent = new Map<string, ModuleRow[]>();
  for (const moduleItem of modules.rows) {
    const key = moduleItem.parent_id ?? "root";
    childrenByParent.set(key, [...(childrenByParent.get(key) ?? []), moduleItem]);
  }
  const nodesByModule = new Map<string, NodeRow[]>();
  for (const node of nodes.rows) {
    const key = node.module_id ?? "none";
    nodesByModule.set(key, [...(nodesByModule.get(key) ?? []), node]);
  }
  const buildModule = (moduleItem: ModuleRow): KnowledgeTreeNode => ({
    id: moduleItem.id,
    name: moduleItem.name,
    kind: moduleItem.kind === "topic" ? "topic" : "module",
    children: [
      ...(childrenByParent.get(moduleItem.id) ?? []).map(buildModule),
      ...(nodesByModule.get(moduleItem.id) ?? []).map((node) => ({
        id: node.id,
        name: node.canonical_title,
        kind: "knowledge" as const,
        changed: node.changed,
        needsReview: node.review_status === "needs_review"
      }))
    ]
  });
  return {
    tree: (childrenByParent.get("root") ?? []).map(buildModule),
    uncategorized: (nodesByModule.get("none") ?? []).map((node) => ({
      id: node.id,
      name: node.canonical_title,
      changed: node.changed,
      needsReview: node.review_status === "needs_review"
    }))
  };
}

export async function getDisplayPreferences(userId: string): Promise<DisplayPreferences> {
  const result = await query<{
    directory_default_expanded: boolean;
    mindmap_default_expanded: boolean;
  }>(
    `SELECT directory_default_expanded, mindmap_default_expanded
       FROM user_preferences
      WHERE user_id = $1`,
    [userId]
  );
  return {
    directoryDefaultExpanded: result.rows[0]?.directory_default_expanded ?? true,
    mindmapDefaultExpanded: result.rows[0]?.mindmap_default_expanded ?? true
  };
}
