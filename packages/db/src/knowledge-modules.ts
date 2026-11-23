import type pg from "pg";

export async function findOrCreateModulePath(
  client: pg.PoolClient,
  userId: string,
  pathParts: Array<string | null | undefined>,
  sortOrder = 500
): Promise<string> {
  const path = pathParts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  let parentId: string | null = null;
  let currentId = "";

  for (const name of path) {
    const found = await client.query<{ id: string }>(
      `SELECT id FROM knowledge_modules
        WHERE user_id = $1
          AND (($2::uuid IS NULL AND parent_id IS NULL) OR parent_id = $2)
          AND lower(name) = lower($3)
        LIMIT 1`,
      [userId, parentId, name]
    );
    if (found.rows[0]) {
      currentId = found.rows[0].id;
      if (sortOrder !== 500) {
        await client.query(
          `UPDATE knowledge_modules
              SET sort_order = CASE
                WHEN sort_order = 0 THEN $3
                ELSE LEAST(sort_order, $3)
              END
            WHERE id = $1 AND user_id = $2`,
          [currentId, userId, sortOrder]
        );
      }
    } else {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO knowledge_modules (user_id, parent_id, kind, name)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [userId, parentId, parentId ? "topic" : "module", name]
      );
      currentId = inserted.rows[0]?.id ?? "";
      if (!currentId) throw new Error("知识分组创建失败");
      await client.query(
        "UPDATE knowledge_modules SET sort_order = $3 WHERE id = $1 AND user_id = $2",
        [currentId, userId, sortOrder]
      );
    }
    if (!currentId) throw new Error("知识分组创建失败");
    parentId = currentId;
  }
  if (!currentId) throw new Error("知识分组不能为空");
  return currentId;
}
