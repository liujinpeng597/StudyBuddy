import { withUserTransaction } from "@studybuddy/db";

export async function getImportDiff(userId: string, jobId: string) {
  const diff = await withUserTransaction(userId, async (client) => {
    const job = await client.query<{
      id: string;
      status: string;
      study_date: string;
      created_at: Date;
    }>("SELECT id, status, study_date::text, created_at FROM import_jobs WHERE id = $1 AND user_id = $2", [
      jobId,
      userId
    ]);
    if (!job.rows[0]) return null;
    const revisions = await client.query(
      `SELECT r.action, r.before_value, r.after_value,
              COALESCE(r.after_value->>'title', r.before_value->>'canonical_title', r.after_value->>'name') AS title
         FROM knowledge_revisions r
        WHERE r.job_id = $1 AND r.user_id = $2
        ORDER BY r.created_at`,
      [jobId, userId]
    );
    const sources = await client.query<{ id: string; file_name: string; type: string }>(
      "SELECT id, file_name, type FROM source_assets WHERE import_job_id = $1 AND user_id = $2",
      [jobId, userId]
    );
    const questions = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM questions WHERE import_job_id = $1 AND user_id = $2",
      [jobId, userId]
    );
    return {
      job: job.rows[0],
      revisions: revisions.rows,
      sources: sources.rows,
      questionCount: Number(questions.rows[0]?.count ?? 0)
    };
  });
  return diff;
}

export async function undoImport(userId: string, jobId: string) {
  return withUserTransaction(userId, async (client) => {
    const job = await client.query<{ id: string; status: string; created_at: Date }>(
      "SELECT id, status, created_at FROM import_jobs WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [jobId, userId]
    );
    const current = job.rows[0];
    if (!current) throw new Error("导入记录不存在");
    if (current.status === "undone") return { ok: true, alreadyUndone: true };
    if (current.status !== "completed") throw new Error("只有已完成的导入可以撤销");
    const nodes = await client.query<{ node_id: string }>(
      "SELECT DISTINCT node_id FROM knowledge_revisions WHERE job_id = $1 AND user_id = $2 AND node_id IS NOT NULL",
      [jobId, userId]
    );
    const nodeIds = nodes.rows.map((row) => row.node_id);
    if (nodeIds.length) {
      const conflicts = await client.query<{ job_id: string; study_date: string }>(
        `SELECT DISTINCT j.id AS job_id, j.study_date::text
           FROM knowledge_revisions r
           JOIN import_jobs j ON j.id = r.job_id
          WHERE r.user_id = $1
            AND r.node_id = ANY($2::uuid[])
            AND j.created_at > $3
            AND j.status = 'completed'
          LIMIT 5`,
        [userId, nodeIds, current.created_at]
      );
      if (conflicts.rowCount) {
        throw new Error(
          `无法直接撤销，后续导入仍依赖这些知识点：${conflicts.rows
            .map((row) => row.study_date)
            .join("、")}`
        );
      }
      await client.query(
        `DELETE FROM knowledge_relations
          WHERE id IN (
            SELECT (after_value->>'relationId')::uuid
              FROM knowledge_revisions
             WHERE job_id = $1 AND user_id = $2
               AND action = 'relation_create'
               AND after_value ? 'relationId'
          )`,
        [jobId, userId]
      );
      await client.query(
        `DELETE FROM source_node_links
          WHERE source_asset_id IN (
            SELECT id FROM source_assets WHERE import_job_id = $1 AND user_id = $2
          )`,
        [jobId, userId]
      );
      const revisionRows = await client.query<{
        action: string;
        before_value: Record<string, unknown> | null;
        after_value: Record<string, unknown> | null;
      }>(
        `SELECT action, before_value, after_value
           FROM knowledge_revisions
          WHERE job_id = $1 AND user_id = $2 AND node_id IS NOT NULL
          ORDER BY created_at DESC`,
        [jobId, userId]
      );
      for (const revision of revisionRows.rows) {
        const nodeId = String(
          revision.after_value?.id ?? revision.before_value?.id ?? ""
        );
        if (!nodeId) continue;
        if (revision.action === "create") {
          await client.query("DELETE FROM knowledge_nodes WHERE id = $1 AND user_id = $2", [
            nodeId,
            userId
          ]);
        }
        if (revision.action === "update" && revision.before_value) {
          const before = revision.before_value as {
            canonical_title?: string;
            summary?: string;
            sections?: unknown;
            aliases?: string[];
            review_status?: string;
          };
          await client.query(
            `UPDATE knowledge_nodes
                SET canonical_title = COALESCE($3, canonical_title),
                    summary = COALESCE($4, summary),
                    sections = COALESCE($5, sections),
                    aliases = COALESCE($6, aliases),
                    review_status = COALESCE($7, review_status),
                    updated_at = now()
              WHERE id = $1 AND user_id = $2`,
            [
              nodeId,
              userId,
              before.canonical_title ?? null,
              before.summary ?? null,
              before.sections ?? null,
              before.aliases ?? null,
              before.review_status ?? null
            ]
          );
          if (before.sections) {
            await client.query(
              `UPDATE search_documents
                  SET body = $3, updated_at = now()
                WHERE user_id = $1 AND node_id = $2 AND document_type = 'knowledge'`,
              [userId, nodeId, JSON.stringify(before.sections)]
            );
          }
        }
      }
      await client.query(
        `DELETE FROM problem_node_links
          WHERE problem_id IN (
            SELECT p.id FROM leetcode_problems p
             JOIN source_assets s ON s.id = p.source_asset_id
            WHERE s.import_job_id = $1 AND p.user_id = $2
          )`,
        [jobId, userId]
      );
    }
    await client.query(
      "UPDATE questions SET status = 'retired' WHERE import_job_id = $1 AND user_id = $2",
      [jobId, userId]
    );
    await client.query(
      `UPDATE import_jobs
          SET status = 'undone', undo_status = 'undone', updated_at = now()
        WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );
    return { ok: true, alreadyUndone: false };
  });
}
