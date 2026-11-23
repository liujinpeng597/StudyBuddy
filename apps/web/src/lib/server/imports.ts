import { createHash, randomUUID } from "node:crypto";
import { detectSourceKind, safeFileName } from "@studybuddy/core";
import { query, withUserTransaction } from "@studybuddy/db";
import { makeSourceKey, putSource } from "@studybuddy/storage";

const maxMarkdown = 5 * 1024 * 1024;
const maxImage = 20 * 1024 * 1024;
const maxAssets = 20;

export async function createImportJob(userId: string, studyDate: string) {
  const result = await query<{ id: string }>(
    `INSERT INTO import_jobs (user_id, study_date, status)
     VALUES ($1, $2::date, 'draft')
     RETURNING id`,
    [userId, studyDate]
  );
  return result.rows[0]?.id;
}

export async function uploadImportAsset(
  userId: string,
  jobId: string,
  file: File
): Promise<{ id: string }> {
  const job = await query<{ status: string }>(
    "SELECT status FROM import_jobs WHERE id = $1 AND user_id = $2",
    [jobId, userId]
  );
  if (job.rows[0]?.status !== "draft") throw new Error("当前导入任务不可上传");
  const count = await query<{ count: string }>(
    "SELECT count(*)::text AS count FROM source_assets WHERE import_job_id = $1",
    [jobId]
  );
  if (Number(count.rows[0]?.count ?? 0) >= maxAssets) throw new Error("单个任务最多 20 个文件");
  const kind = detectSourceKind(file.name, file.type);
  if (kind === "unsupported") throw new Error("仅支持 Markdown、PNG、JPEG 和 WebP");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) throw new Error("文件为空");
  if (kind === "markdown" && buffer.length > maxMarkdown) throw new Error("Markdown 文件不能超过 5 MiB");
  if (kind === "image" && buffer.length > maxImage) throw new Error("截图不能超过 20 MiB");
  if (kind === "markdown" && !/\.(md|markdown)$/i.test(file.name)) {
    throw new Error("Markdown 扩展名不合法");
  }
  if (kind === "image") {
    const isPng = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
    const isWebp =
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP";
    if (!isPng && !isJpeg && !isWebp) throw new Error("图片内容与格式不匹配");
  }
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const duplicate = await query(
    "SELECT 1 FROM source_assets WHERE import_job_id = $1 AND checksum = $2",
    [jobId, checksum]
  );
  if (duplicate.rowCount) throw new Error("同一个文件已经上传");
  const assetId = randomUUID();
  const fileName = safeFileName(file.name);
  const storagePath = makeSourceKey(userId, jobId, assetId, fileName);
  await putSource(storagePath, buffer, file.type);
  await query(
    `INSERT INTO source_assets
       (id, user_id, import_job_id, type, file_name, mime_type, storage_path, checksum, byte_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [assetId, userId, jobId, kind, fileName, file.type, storagePath, checksum, buffer.length]
  );
  return { id: assetId };
}

export async function submitImportJob(userId: string, jobId: string) {
  return withUserTransaction(userId, async (client) => {
    const result = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM source_assets WHERE import_job_id = $1 AND user_id = $2",
      [jobId, userId]
    );
    if (Number(result.rows[0]?.count ?? 0) === 0) throw new Error("至少上传一个文件");
    const updated = await client.query(
      `UPDATE import_jobs
          SET status = 'queued', progress = 5, error_code = NULL, error_message = NULL, updated_at = now()
        WHERE id = $1 AND user_id = $2 AND status = 'draft'
        RETURNING id`,
      [jobId, userId]
    );
    if (!updated.rowCount) throw new Error("导入任务状态不允许提交");
    return { ok: true };
  });
}

export async function getLatestJob(userId: string) {
  const result = await query<{
    id: string;
    status: string;
    progress: number;
    study_date: string;
    error_message: string | null;
    summary: unknown;
    question_status: string;
    created_at: Date;
  }>(
    `SELECT id, status, progress, study_date::text, error_message, summary, question_status, created_at
       FROM import_jobs
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId]
  );
  const job = result.rows[0];
  return job ? mapJob(job) : null;
}

export async function listImportJobs(userId: string) {
  const result = await query(
    `SELECT j.id, j.status, j.progress, j.study_date::text, j.error_message, j.summary,
            j.created_at, count(s.id)::int AS source_count
       FROM import_jobs j
       LEFT JOIN source_assets s ON s.import_job_id = j.id
      WHERE j.user_id = $1
      GROUP BY j.id
      ORDER BY j.created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    progress: row.progress,
    studyDate: row.study_date,
    errorMessage: row.error_message,
    summary: row.summary,
    createdAt: row.created_at,
    sourceCount: row.source_count
  }));
}

export async function getImportJob(userId: string, jobId: string) {
  const result = await query<{
    id: string;
    status: string;
    progress: number;
    study_date: string;
    error_message: string | null;
    summary: unknown;
    question_status: string;
    created_at: Date;
    undo_status: string;
    assets: Array<{ id: string; type: string; fileName: string; mimeType: string; status: string }>;
  }>(
    `SELECT j.id, j.status, j.progress, j.study_date::text, j.error_message, j.summary,
            j.created_at, j.question_status, j.undo_status,
            COALESCE(
              json_agg(json_build_object(
                'id', s.id,
                'type', s.type,
                'fileName', s.file_name,
                'mimeType', s.mime_type,
                'status', s.status
              )) FILTER (WHERE s.id IS NOT NULL),
              '[]'
            ) AS assets
       FROM import_jobs j
       LEFT JOIN source_assets s ON s.import_job_id = j.id
      WHERE j.user_id = $1 AND j.id = $2
      GROUP BY j.id`,
    [userId, jobId]
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...mapJob(row),
    assets: row.assets,
    questionStatus: row.question_status,
    undoStatus: row.undo_status
  };
}

function mapJob(row: {
  id: string;
  status: string;
  progress: number;
  study_date?: string;
  error_message: string | null;
  summary: unknown;
  question_status: string;
  created_at: Date;
}) {
  return {
    id: row.id,
    status: row.status,
    progress: row.progress,
    studyDate: row.study_date,
    errorMessage: row.error_message,
    summary: row.summary,
    questionStatus: row.question_status,
    createdAt: row.created_at
  };
}
