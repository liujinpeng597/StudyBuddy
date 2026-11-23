import { NextResponse } from "next/server";
import { z } from "zod";
import {
  answerEvaluationSchema,
  getServerEnv,
  scoreObjectiveQuestion
} from "@studybuddy/core";
import { query } from "@studybuddy/db";
import { generateJson, resolveModelProfile } from "@studybuddy/ai";
import { requireApiUser } from "@/lib/server/auth";
import { assertSameOrigin, errorResponse, jsonError } from "@/lib/server/http";

const attemptSchema = z.object({
  questionId: z.uuid(),
  answer: z.union([z.string().max(10_000), z.array(z.string().max(500)).max(8)])
});

type QuestionRow = {
  id: string;
  type: string;
  prompt: string;
  options: string[];
  answer_key: unknown;
  correct_indexes: number[];
  explanation: string;
  rubric: string[];
  source_node_ids: string[];
};

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? 200);
    const limit = Math.max(1, Math.min(500, Number.isFinite(requestedLimit) ? requestedLimit : 200));
    const result = await query<{
      id: string;
      question_id: string;
      import_job_id: string;
      answer: unknown;
      score: number | null;
      feedback: Record<string, unknown> | null;
      created_at: Date;
      type: string;
      prompt: string;
      options: string[];
      answer_key: unknown;
      correct_indexes: number[];
      explanation: string;
      rubric: string[];
      source_title: string | null;
    }>(
      `SELECT a.id, a.question_id, q.import_job_id, a.answer, a.score::float8,
              a.feedback, a.created_at, q.type, q.prompt, q.options, q.answer_key,
              q.correct_indexes, q.explanation, q.rubric,
              n.canonical_title AS source_title
         FROM attempts a
         JOIN questions q ON q.id = a.question_id AND q.user_id = a.user_id
         LEFT JOIN knowledge_nodes n ON n.id = q.source_node_ids[1] AND n.user_id = a.user_id
        WHERE a.user_id = $1
        ORDER BY a.created_at DESC
        LIMIT $2`,
      [user.id, limit]
    );
    return NextResponse.json({
      attempts: result.rows.map((row) => {
        const feedback = row.feedback ?? {};
        const aiEvaluated = feedback.ai === true;
        const isCorrect =
          row.type === "short_answer"
            ? aiEvaluated
              ? (row.score ?? 0) >= 3.5
              : null
            : feedback.correct === true || (row.score ?? 0) >= 1;
        return {
          id: row.id,
          questionId: row.question_id,
          jobId: row.import_job_id,
          type: row.type,
          prompt: row.prompt,
          options: row.options,
          answerKey: row.answer_key,
          correctIndexes: row.correct_indexes,
          explanation: row.explanation,
          rubric: row.rubric,
          sourceTitle: row.source_title,
          answer: row.answer,
          score: row.score,
          feedback,
          createdAt: row.created_at,
          isCorrect
        };
      })
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return jsonError("请先登录", 401);
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await requireApiUser();
    const parsed = attemptSchema.safeParse(await request.json());
    if (!parsed.success) return jsonError("作答内容不合法");
    const questionResult = await query<QuestionRow>(
      `SELECT id, type, prompt, options, answer_key, correct_indexes, explanation, rubric, source_node_ids
         FROM questions
        WHERE id = $1 AND user_id = $2 AND status = 'active'`,
      [parsed.data.questionId, user.id]
    );
    const question = questionResult.rows[0];
    if (!question) return jsonError("题目不存在", 404);
    if (question.type !== "short_answer") {
      const result = scoreObjectiveQuestion(
        {
          type: question.type as "single_choice" | "multiple_choice" | "fill_blank" | "true_false",
          options: question.options,
          answerKey: question.answer_key as string | string[],
          correctIndexes: question.correct_indexes
        },
        parsed.data.answer
      );
      const inserted = await query<{ id: string; created_at: Date }>(
        `INSERT INTO attempts (user_id, question_id, answer, score, feedback)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [
          user.id,
          question.id,
          JSON.stringify(parsed.data.answer),
          result.correct ? 1 : 0,
          { correct: result.correct, explanation: question.explanation }
        ]
      );
      return NextResponse.json({
        correct: result.correct,
        explanation: question.explanation,
        correctAnswer: question.answer_key ?? question.correct_indexes,
        attemptId: inserted.rows[0]?.id,
        attemptedAt: inserted.rows[0]?.created_at
      });
    }

    const textAnswer = Array.isArray(parsed.data.answer)
      ? parsed.data.answer.join(" ")
      : parsed.data.answer;
    if (!textAnswer.trim()) return jsonError("请先填写回答");
    try {
      const env = getServerEnv();
      const usage = await query<{ count: string }>(
        "SELECT count(*)::text AS count FROM attempts WHERE user_id = $1 AND created_at >= date_trunc('day', now()) AND feedback IS NOT NULL AND feedback->>'ai' = 'true'",
        [user.id]
      );
      if (Number(usage.rows[0]?.count ?? 0) >= env.MAX_AI_EVALUATIONS_PER_DAY) {
        throw new Error("今日问答题 AI 评分次数已用完");
      }
      const profile = await resolveModelProfile(user.id, "answer_evaluation");
      const evaluation = await generateJson(profile, answerEvaluationSchema, {
        system: `你是严格但有用的计算机学习面试教练。只输出 JSON。
按 rubric 检查回答：coveredPoints、missingPoints、incorrectPoints、clarityFeedback、
score(0-5)、confidence(0-1)、usedSourceNodeIds。不得引入 rubric 之外的要求。
低置信度时降低 confidence，不要伪造确定评分。`,
        user: JSON.stringify({
          question: question.prompt,
          rubric: question.rubric,
          answer: textAnswer,
          sourceNodeIds: question.source_node_ids
        }),
        maxTokens: 1800
      });
      const feedback = { ...evaluation, ai: true };
      const inserted = await query<{ id: string; created_at: Date }>(
        `INSERT INTO attempts (user_id, question_id, answer, score, feedback)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, created_at`,
        [user.id, question.id, JSON.stringify(textAnswer), evaluation.score, feedback]
      );
      return NextResponse.json({
        ai: true,
        evaluation,
        lowConfidence: evaluation.confidence < env.SHORT_ANSWER_CONFIDENCE_THRESHOLD,
        attemptId: inserted.rows[0]?.id,
        attemptedAt: inserted.rows[0]?.created_at
      });
    } catch (error) {
      const inserted = await query<{ id: string; created_at: Date }>(
        `INSERT INTO attempts (user_id, question_id, answer, feedback)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`,
        [
          user.id,
          question.id,
          JSON.stringify(textAnswer),
          { ai: false, unavailable: true, message: messageOf(error) }
        ]
      );
      return NextResponse.json(
        {
          ai: false,
          unavailable: true,
          message: "AI 评分暂时不可用。请对照评分要点自行检查。",
          rubric: question.rubric,
          explanation: question.explanation,
          attemptId: inserted.rows[0]?.id,
          attemptedAt: inserted.rows[0]?.created_at
        },
        { status: 200 }
      );
    }
  } catch (error) {
    return errorResponse(error);
  }
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "评分失败";
}
