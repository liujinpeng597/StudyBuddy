import { NextResponse } from "next/server";
import { query } from "@studybuddy/db";
import { requireApiUser } from "@/lib/server/auth";
import { errorResponse, jsonError } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const requestedJobId = new URL(request.url).searchParams.get("jobId");
    const jobResult = requestedJobId
      ? await query<{ id: string }>(
          "SELECT id FROM import_jobs WHERE id = $1 AND user_id = $2 AND status = 'completed'",
          [requestedJobId, user.id]
        )
      : await query<{ id: string }>(
          `SELECT id FROM import_jobs
            WHERE user_id = $1 AND status = 'completed'
            ORDER BY finished_at DESC NULLS LAST
            LIMIT 1`,
          [user.id]
        );
    const jobId = jobResult.rows[0]?.id;
    if (!jobId) return NextResponse.json({ jobId: null, questions: [] });
    const result = await query(
      `SELECT q.id, q.type, q.prompt, q.options, q.answer_key, q.correct_indexes,
              q.explanation, q.rubric, q.source_node_ids, q.status,
              n.canonical_title AS source_title
         FROM questions q
         LEFT JOIN knowledge_nodes n ON n.id = q.source_node_ids[1]
        WHERE q.user_id = $1 AND q.import_job_id = $2 AND q.status = 'active'
        ORDER BY CASE
          WHEN q.type = 'short_answer' THEN 1 ELSE 0
        END, q.created_at, q.id`,
      [user.id, jobId]
    );
    return NextResponse.json({
      jobId,
      questions: result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        prompt: row.prompt,
        options: row.options,
        answerKey: row.answer_key,
        correctIndexes: row.correct_indexes,
        explanation: row.explanation,
        rubric: row.rubric,
        sourceNodeIds: row.source_node_ids,
        sourceTitle: row.source_title
      }))
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    return errorResponse(error);
  }
}
