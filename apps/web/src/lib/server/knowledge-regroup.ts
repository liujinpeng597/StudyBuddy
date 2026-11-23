import { createHash } from "node:crypto";
import { findOrCreateModulePath, query, withUserTransaction } from "@studybuddy/db";
import { classifyKnowledgeGroups, resolveModelProfile } from "@studybuddy/ai";

export async function regroupKnowledge(userId: string) {
  const [nodes, modules] = await Promise.all([
    query<{
      id: string;
      canonical_title: string;
      summary: string;
      module_id: string | null;
    }>(
      `SELECT id, canonical_title, summary, module_id
         FROM knowledge_nodes
        WHERE user_id = $1
        ORDER BY id`,
      [userId]
    ),
    query<{ id: string; parent_id: string | null; name: string }>(
      "SELECT id, parent_id, name FROM knowledge_modules WHERE user_id = $1",
      [userId]
    )
  ]);
  if (!nodes.rows.length) return { changed: 0 };
  if (nodes.rows.length > 80) {
    throw new Error("单次 AI 重组最多支持 80 个知识点");
  }
  const pathByModule = buildModulePaths(modules.rows);
  const existingGroups = [
    ...new Set(nodes.rows.map((node) => pathByModule.get(node.module_id ?? "") ?? []).map((path) => path.join(" > ")))
  ]
    .filter(Boolean)
    .map((path) => path.split(" > "));
  const signature = createHash("sha256")
    .update(
      JSON.stringify(
        nodes.rows.map((node) => ({
          id: node.id,
          title: node.canonical_title,
          summary: node.summary
        }))
      )
    )
    .digest("hex");
  const cached = await query("SELECT 1 FROM knowledge_regroup_runs WHERE user_id = $1 AND signature = $2", [
    userId,
    signature
  ]);
  if (cached.rowCount) {
    return { changed: 0, cached: true };
  }

  const profile = await resolveModelProfile(userId, "merge_judgement");
  const classified = await classifyKnowledgeGroups(
    profile,
    nodes.rows.map((node) => ({
      id: node.id,
      title: node.canonical_title,
      summary: node.summary,
      currentPath: pathByModule.get(node.module_id ?? "") ?? []
    })),
    existingGroups
  );
  const knownIds = new Set(nodes.rows.map((node) => node.id));
  const seen = new Set<string>();
  for (const group of [...classified.groups].sort((left, right) => left.groupOrder - right.groupOrder)) {
    for (const nodeId of group.nodeIds) {
      if (!knownIds.has(nodeId)) throw new Error("AI 返回了不存在的知识点");
      if (seen.has(nodeId)) throw new Error("AI 将同一个知识点分到了多个组");
      seen.add(nodeId);
    }
  }
  if (seen.size !== knownIds.size) {
    throw new Error(`AI 漏掉了 ${knownIds.size - seen.size} 个知识点，本次未修改分类`);
  }
  await withUserTransaction(userId, async (client) => {
    const orderedGroups = [...classified.groups].sort(
      (left, right) => left.groupOrder - right.groupOrder
    );
    for (const group of orderedGroups) {
      const moduleId = await findOrCreateModulePath(client, userId, [
        group.module,
        ...group.topicPath
      ], group.groupOrder);
      for (let index = 0; index < group.nodeIds.length; index += 1) {
        await client.query(
          `UPDATE knowledge_nodes
              SET module_id = $3, study_order = $4, updated_at = now()
            WHERE user_id = $1 AND id = $2`,
          [userId, group.nodeIds[index], moduleId, group.groupOrder * 100 + index]
        );
      }
    }
    let removed = 1;
    while (removed > 0) {
      const empty = await client.query(
        `DELETE FROM knowledge_modules m
          WHERE m.user_id = $1
            AND NOT EXISTS (SELECT 1 FROM knowledge_nodes n WHERE n.module_id = m.id)
            AND NOT EXISTS (
              SELECT 1 FROM knowledge_modules child WHERE child.parent_id = m.id
            )
          RETURNING m.id`,
        [userId]
      );
      removed = empty.rowCount ?? 0;
    }
    await client.query(
      `INSERT INTO knowledge_regroup_runs (user_id, signature, result)
       VALUES ($1, $2, $3)`,
      [userId, signature, JSON.stringify(classified)]
    );
  });
  return { changed: seen.size, unclassified: nodes.rows.length - seen.size };
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
