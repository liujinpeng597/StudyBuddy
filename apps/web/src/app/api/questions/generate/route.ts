import { NextResponse } from "next/server";
import { z } from "zod";
import { generateJson, resolveModelProfile } from "@studybuddy/ai";
import {
  normalizeGeneratedQuestionCandidates,
  normalizeText,
  questionCandidateSchema,
  type KnowledgeSections
} from "@studybuddy/core";
import { query } from "@studybuddy/db";
import { requireApiUser } from "@/lib/server/auth";
import { assertSameOrigin, errorResponse, jsonError } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const generationSchema = z.object({
  questions: z.array(z.unknown()).min(1).max(16)
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    enforceRateLimit(`question-generate:${user.id}`, 5, 60 * 60_000);
    const job = await query<{ id: string }>(
      `SELECT id FROM import_jobs
        WHERE user_id = $1 AND status = 'completed'
        ORDER BY finished_at DESC NULLS LAST
        LIMIT 1`,
      [user.id]
    );
    const jobId = job.rows[0]?.id;
    if (!jobId) return jsonError("请先导入并整理一份笔记");

    const [nodes, existing] = await Promise.all([
      query<{
        id: string;
        title: string;
        summary: string;
        sections: KnowledgeSections;
      }>(
        `SELECT n.id, n.canonical_title AS title, n.summary, n.sections
           FROM knowledge_nodes n
          WHERE n.user_id = $1
          ORDER BY
            EXISTS (
              SELECT 1 FROM knowledge_revisions r
               WHERE r.user_id = $1 AND r.job_id = $2 AND r.node_id = n.id
            ) DESC,
            n.updated_at DESC
          LIMIT 20`,
        [user.id, jobId]
      ),
      query<{ prompt: string }>(
        "SELECT prompt FROM questions WHERE user_id = $1 AND status = 'active'",
        [user.id]
      )
    ]);
    if (!nodes.rows.length) return jsonError("还没有可用于出题的知识点");

    const allowedIds = new Set(nodes.rows.map((node) => node.id));
    const existingPrompts = new Set(
      existing.rows.map((row) => normalizeText(row.prompt).toLocaleLowerCase("zh-CN"))
    );
    const profile = await resolveModelProfile(user.id, "question_generation");
    const generated = await generateJson(profile, generationSchema, {
      system: `你是基于个人笔记出题的计算机学习教练。只输出 JSON。
生成 10 道新的复习题：3 道单选、2 道多选、1 道填空、1 道判断、3 道问答。
题目必须清楚、单点、可判定，不使用“以下哪项最符合这段文字”这类模糊问法。
优先考查定义边界、机制原因、适用场景、优缺点和相近概念区别。
多选题至少两个正确选项；问答题至少 3 个 rubric 要点。
每道题必须引用提供的 sourceNodeIds，不要重复已有题目，不要生成代码执行题。
输出 {"questions":[...]}。`,
      user: JSON.stringify({
        existingPrompts: [...existingPrompts],
        nodes: nodes.rows.map((node) => ({
          id: node.id,
          title: node.title,
          summary: node.summary,
          sections: node.sections
        }))
      }),
      maxTokens: 7000,
      thinking: "disabled"
    });
    const unique = normalizeGeneratedQuestionCandidates(generated).filter((question) => {
      const normalized = normalizeText(question.prompt).toLocaleLowerCase("zh-CN");
      if (existingPrompts.has(normalized)) return false;
      if (!question.sourceNodeIds.every((id) => allowedIds.has(id))) return false;
      existingPrompts.add(normalized);
      return true;
    });
    if (!unique.length) return jsonError("模型没有生成新的有效题目，请稍后再试");

    let created = 0;
    for (const question of unique) {
      const parsed = questionCandidateSchema.safeParse(question);
      if (!parsed.success) continue;
      await query(
        `INSERT INTO questions
           (user_id, import_job_id, type, prompt, options, answer_key, correct_indexes,
            explanation, rubric, source_node_ids)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          user.id,
          jobId,
          parsed.data.type,
          parsed.data.prompt,
          JSON.stringify(parsed.data.options),
          parsed.data.answerKey === undefined ? null : JSON.stringify(parsed.data.answerKey),
          parsed.data.correctIndexes,
          parsed.data.explanation,
          JSON.stringify(parsed.data.rubric),
          parsed.data.sourceNodeIds
        ]
      );
      created += 1;
    }
    return NextResponse.json({ created });
  } catch (error) {
    return errorResponse(error);
  }
}
