import { z } from "zod";

export const relationTypes = [
  "prerequisite",
  "part_of",
  "related",
  "contrast",
  "applies_to"
] as const;

export const relationTypeSchema = z.enum(relationTypes);
export type RelationType = z.infer<typeof relationTypeSchema>;

export const taskRoles = [
  "image_extraction",
  "normalization",
  "merge_judgement",
  "embedding",
  "question_generation",
  "answer_evaluation"
] as const;

export const taskRoleSchema = z.enum(taskRoles);
export type TaskRole = z.infer<typeof taskRoleSchema>;

export const capabilitySchema = z.enum(["text", "json", "vision", "embedding"]);
export type ModelCapability = z.infer<typeof capabilitySchema>;

export const knowledgeSectionsSchema = z.object({
  definition: z.string().min(1),
  purpose: z.string().min(1),
  implementation: z.string().min(1),
  useCases: z.string().min(1),
  rationale: z.string().min(1),
  advantages: z.string().min(1),
  disadvantages: z.string().min(1),
  relatedPoints: z.string().min(1),
  differences: z.string().min(1)
});

export type KnowledgeSections = z.infer<typeof knowledgeSectionsSchema>;

export const knowledgeCandidateSchema = z.object({
  title: z.string().trim().min(1).max(160),
  moduleHint: z.string().trim().min(1).max(80).default("未分类"),
  topicPath: z.array(z.string().trim().min(1).max(80)).max(4).default([]),
  aliases: z.array(z.string().trim().min(1).max(160)).max(20).default([]),
  summary: z.string().trim().min(1).max(600),
  sections: knowledgeSectionsSchema,
  relatedTitles: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  sourceExcerpts: z.array(z.string().min(1).max(4000)).min(1).max(20),
  originalQuestions: z.array(z.string().min(1).max(1000)).max(20).default([])
});

export type KnowledgeCandidate = z.infer<typeof knowledgeCandidateSchema>;

export const knowledgeCandidateResponseSchema = z.object({
  candidates: z.array(knowledgeCandidateSchema).max(20)
});

export const leetcodeCandidateSchema = z.object({
  title: z.string().trim().max(200).nullable(),
  number: z.number().int().positive().nullable(),
  description: z.string().trim().max(20_000).nullable(),
  language: z.string().trim().max(40).nullable(),
  code: z.string().max(30_000).nullable(),
  dataStructures: z.array(z.string().max(80)).max(20).default([]),
  algorithms: z.array(z.string().max(80)).max(20).default([]),
  complexity: z.object({
    time: z.string().max(160).nullable(),
    space: z.string().max(160).nullable()
  }),
  optimizationNotes: z.string().max(2000).nullable(),
  incompleteFields: z.array(z.string().max(80)).max(20).default([])
});

export type LeetCodeCandidate = z.infer<typeof leetcodeCandidateSchema>;

export const objectiveQuestionTypes = [
  "single_choice",
  "multiple_choice",
  "fill_blank",
  "true_false"
] as const;

export const questionTypeSchema = z.enum([...objectiveQuestionTypes, "short_answer"]);
export type QuestionType = z.infer<typeof questionTypeSchema>;

export const questionCandidateSchema = z
  .object({
    type: questionTypeSchema,
    prompt: z.string().trim().min(1).max(4000),
    options: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
    answerKey: z.union([z.string(), z.array(z.string())]).optional(),
    correctIndexes: z.array(z.number().int().min(0).max(7)).max(8).default([]),
    explanation: z.string().trim().min(1).max(4000),
    rubric: z.array(z.string().trim().min(1).max(500)).max(10).default([]),
    sourceNodeIds: z.array(z.uuid()).min(1).max(12)
  })
  .superRefine((question, ctx) => {
    if (question.type === "single_choice") {
      if (question.options.length !== 4 || question.correctIndexes.length !== 1) {
        ctx.addIssue({
          code: "custom",
          message: "单选题必须有 4 个选项和 1 个正确答案"
        });
      }
    }
    if (question.type === "multiple_choice") {
      if (question.options.length < 2 || question.correctIndexes.length < 1) {
        ctx.addIssue({
          code: "custom",
          message: "多选题必须至少有 2 个选项和 1 个正确答案"
        });
      }
    }
    if (question.type === "short_answer" && question.rubric.length < 3) {
      ctx.addIssue({
        code: "custom",
        message: "问答题至少需要 3 个评分要点"
      });
    }
  });

export type QuestionCandidate = z.infer<typeof questionCandidateSchema>;

export const answerEvaluationSchema = z.object({
  coveredPoints: z.array(z.string().min(1)).max(10),
  missingPoints: z.array(z.string().min(1)).max(10),
  incorrectPoints: z.array(z.string().min(1)).max(10),
  clarityFeedback: z.string().min(1).max(2000),
  score: z.number().min(0).max(5),
  confidence: z.number().min(0).max(1),
  usedSourceNodeIds: z.array(z.uuid()).max(12)
});

export type AnswerEvaluation = z.infer<typeof answerEvaluationSchema>;

export type KnowledgeTreeNode = {
  id: string;
  name: string;
  kind: "module" | "topic" | "knowledge";
  changed?: boolean;
  needsReview?: boolean;
  children?: KnowledgeTreeNode[];
};

export type KnowledgeTreePayload = {
  tree: KnowledgeTreeNode[];
  uncategorized: Array<{
    id: string;
    name: string;
    changed?: boolean;
    needsReview?: boolean;
  }>;
};

export type DisplayPreferences = {
  directoryDefaultExpanded: boolean;
  mindmapDefaultExpanded: boolean;
};

export const relationSchema = z.object({
  sourceTitle: z.string().min(1),
  targetTitle: z.string().min(1),
  type: relationTypeSchema,
  confidence: z.number().min(0).max(1).default(0.7)
});

export function normalizeText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("zh-CN");
}
