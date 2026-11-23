import "dotenv/config";
import { closePool, query } from "@studybuddy/db";

const tables = [
  "users",
  "sessions",
  "knowledge_nodes",
  "search_documents",
  "import_jobs",
  "questions"
];

for (const table of tables) {
  const result = await query<{ count: string }>(`SELECT count(*)::text AS count FROM ${table}`);
  console.log(`${table}: ${result.rows[0]?.count ?? "0"}`);
}

const jobs = await query<{
  status: string;
  progress: number;
  started_at: Date | null;
  finished_at: Date | null;
  source_count: number;
  title_count: number;
}>(
  `SELECT j.status, j.progress, j.started_at, j.finished_at,
          count(DISTINCT s.id)::int AS source_count,
          count(DISTINCT c.id)::int AS title_count
     FROM import_jobs j
     LEFT JOIN source_assets s ON s.import_job_id = j.id
     LEFT JOIN knowledge_candidates c ON c.job_id = j.id
    GROUP BY j.id
    ORDER BY j.created_at DESC
    LIMIT 5`
);

for (const job of jobs.rows) {
  const seconds =
    job.started_at && job.finished_at
      ? Math.round((job.finished_at.getTime() - job.started_at.getTime()) / 1000)
      : null;
  console.log(
    `job: ${job.status} ${job.progress}% sources=${job.source_count} candidates=${job.title_count} duration=${seconds ?? "running"}s`
  );
}

const groups = await query<{
  module: string;
  parent: string | null;
  sort_order: number;
  node_count: number;
}>(
  `SELECT m.name AS module, p.name AS parent, m.sort_order, count(n.id)::int AS node_count
     FROM knowledge_modules m
     LEFT JOIN knowledge_modules p ON p.id = m.parent_id
     LEFT JOIN knowledge_nodes n ON n.module_id = m.id
    GROUP BY m.id, p.name, m.sort_order
    HAVING count(n.id) > 0
    ORDER BY p.name NULLS FIRST, m.sort_order, m.name`
);

for (const group of groups.rows) {
  console.log(
    `group: ${group.parent ? `${group.parent} / ` : ""}${group.module} (${group.node_count}, order=${group.sort_order})`
  );
}

await closePool();
