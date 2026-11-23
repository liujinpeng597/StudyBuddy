import {
  normalizeAnswer,
  questionCandidateSchema,
  type QuestionCandidate,
  type QuestionType
} from "./contracts";

export type ObjectiveQuestion = {
  type: "single_choice" | "multiple_choice" | "fill_blank" | "true_false";
  options: string[];
  answerKey?: string | string[];
  correctIndexes: number[];
};

export function scoreObjectiveQuestion(
  question: ObjectiveQuestion,
  answer: string | string[]
): { correct: boolean; normalizedAnswer: string | string[] | number[] } {
  if (question.type === "fill_blank") {
    const accepted = Array.isArray(question.answerKey)
      ? question.answerKey.map(normalizeAnswer)
      : [normalizeAnswer(String(question.answerKey ?? ""))];
    const normalized = normalizeAnswer(Array.isArray(answer) ? answer.join(" ") : answer);
    return { correct: accepted.includes(normalized), normalizedAnswer: normalized };
  }

  if (question.type === "true_false") {
    const normalized = normalizeAnswer(Array.isArray(answer) ? answer[0] ?? "" : answer);
    const expected = normalizeAnswer(String(question.answerKey ?? ""));
    return { correct: normalized === expected, normalizedAnswer: normalized };
  }

  const selected = (Array.isArray(answer) ? answer : [answer])
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value))
    .sort((a, b) => a - b);
  const expected = [...question.correctIndexes].sort((a, b) => a - b);
  return {
    correct:
      selected.length === expected.length && selected.every((value, index) => value === expected[index]),
    normalizedAnswer: selected
  };
}

export function normalizeQuestionType(value: unknown): QuestionType | null {
  if (typeof value !== "string") return null;
  const normalized = value.toLocaleLowerCase("zh-CN").replace(/[\s_-]+/g, "");
  const aliases: Record<string, QuestionType> = {
    singlechoice: "single_choice",
    single: "single_choice",
    choice: "single_choice",
    单选: "single_choice",
    单选题: "single_choice",
    multiplechoice: "multiple_choice",
    multiple: "multiple_choice",
    multi: "multiple_choice",
    多选: "multiple_choice",
    多选题: "multiple_choice",
    fillblank: "fill_blank",
    blank: "fill_blank",
    fill: "fill_blank",
    填空: "fill_blank",
    填空题: "fill_blank",
    truefalse: "true_false",
    boolean: "true_false",
    judgment: "true_false",
    判断: "true_false",
    判断题: "true_false",
    shortanswer: "short_answer",
    short: "short_answer",
    qa: "short_answer",
    essay: "short_answer",
    问答: "short_answer",
    问答题: "short_answer",
    简答: "short_answer",
    简答题: "short_answer"
  };
  return aliases[normalized] ?? null;
}

export function normalizeGeneratedQuestionCandidates(payload: unknown): QuestionCandidate[] {
  const questions: QuestionCandidate[] = [];
  for (const rawQuestion of extractQuestionArray(payload)) {
    if (!rawQuestion || typeof rawQuestion !== "object" || Array.isArray(rawQuestion)) continue;
    const raw = rawQuestion as Record<string, unknown>;
    const type = normalizeQuestionType(raw.type ?? raw.questionType ?? raw.question_type);
    if (!type) continue;
    const prompt = firstText(raw.prompt, raw.question, raw.title);
    if (!prompt) continue;
    let options = stringArray(raw.options ?? raw.choices).slice(0, 8);
    if (type === "true_false" && options.length === 0) options = ["正确", "错误"];
    const rawAnswer =
      raw.answerKey ??
      raw.answer_key ??
      raw.correctAnswer ??
      raw.correct_answer ??
      raw.answer;
    const answerKey = normalizeAnswerKey(rawAnswer);
    let correctIndexes = indexArray(
      raw.correctIndexes ?? raw.correct_indexes ?? raw.correctOptions ?? raw.correct_options,
      options
    );
    if (!correctIndexes.length && answerKey !== undefined && options.length) {
      const answers = Array.isArray(answerKey) ? answerKey : [answerKey];
      correctIndexes = [
        ...new Set(
          answers
            .map((answer) => optionIndex(answer, options))
            .filter((index): index is number => index !== null)
        )
      ];
    }
    const sourceNodeIds = stringArray(
      raw.sourceNodeIds ?? raw.source_node_ids ?? raw.nodeIds ?? raw.node_ids
    );
    if (!sourceNodeIds.length) continue;
    const explanation =
      firstText(raw.explanation, raw.rationale, raw.reason, raw.analysis) ??
      "请结合对应知识点复习。";
    let rubric = stringArray(
      raw.rubric ?? raw.scoringPoints ?? raw.scoring_points ?? raw.gradingPoints
    );
    if (type === "short_answer" && rubric.length < 3) {
      rubric = [
        ...rubric,
        ...splitText(raw.explanation ?? raw.analysis ?? prompt)
      ].slice(0, 10);
    }
    const parsed = questionCandidateSchema.safeParse({
      type,
      prompt,
      options,
      answerKey,
      correctIndexes,
      explanation,
      rubric,
      sourceNodeIds
    });
    if (parsed.success) questions.push(parsed.data);
  }
  return questions;
}

function extractQuestionArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["questions", "items", "data", "results", "quiz"]) {
    if (Array.isArray(record[key])) return record[key];
  }
  return [];
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return firstText(record.text, record.value, record.label, record.content);
        }
        return null;
      })
      .filter((item): item is string => Boolean(item));
  }
  if (typeof value === "string") return [value.trim()].filter(Boolean);
  return [];
}

function splitText(value: unknown) {
  if (typeof value !== "string") return [];
  return value
    .split(/[\n；;。]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeAnswerKey(value: unknown): string | string[] | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "boolean") return value ? "正确" : "错误";
  if (Array.isArray(value)) {
    const values = value.map((item) => String(item).trim()).filter(Boolean);
    if (values.length) return values;
  }
  if (typeof value === "number") return String(value);
  return undefined;
}

function indexArray(value: unknown, options: string[]) {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return [
    ...new Set(
      values
        .map((item) => optionIndex(item, options))
        .filter((index): index is number => index !== null)
    )
  ];
}

function optionIndex(value: unknown, options: string[]) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value >= 0 && value < options.length ? value : null;
  }
  const text = String(value).trim();
  if (/^\d+$/.test(text)) {
    const index = Number(text);
    return index >= 0 && index < options.length ? index : null;
  }
  if (/^[A-Ha-h]$/.test(text)) {
    const index = text.toUpperCase().charCodeAt(0) - 65;
    return index < options.length ? index : null;
  }
  const index = options.findIndex((option) => normalizeAnswer(option) === normalizeAnswer(text));
  return index >= 0 ? index : null;
}

export function localKnowledgeFallback(markdown: string, title: string) {
  const cleaned = markdown.replace(/^#{1,6}\s+/gm, "").trim();
  const summary = cleaned.split(/\n+/).find(Boolean)?.slice(0, 300) ?? title;
  const haystack = `${title}\n${cleaned}`;
  const moduleHint = /C\+\+|虚函数|多态|继承|构造|析构|类与对象/.test(haystack)
    ? "C++"
    : /TCP|UDP|网络|拥塞|协议|HTTP/.test(haystack)
      ? "计算机网络"
      : /算法|复杂度|树|图|排序|LeetCode/.test(haystack)
        ? "数据结构与算法"
        : /Python|装饰器|生成器/.test(haystack)
          ? "Python"
          : /Linux|终端|进程|线程|文件权限/.test(haystack)
            ? "Linux"
            : "待归类";
  const topicPath =
    moduleHint === "Linux"
      ? /管道|IPC|信号|共享内存|消息队列|套接字/.test(haystack)
        ? ["进程管理", "进程间通信"]
        : /fork|exec|wait|进程组|会话|僵尸/.test(haystack)
          ? ["进程管理", "进程关系"]
          : /mmap|内存映射|虚拟内存|页表/.test(haystack)
            ? ["内存管理"]
            : []
      : moduleHint === "计算机网络"
        ? /TCP|拥塞|慢启动|重传/.test(haystack)
          ? ["传输层", "TCP"]
          : /UDP/.test(haystack)
            ? ["传输层", "UDP"]
            : []
        : moduleHint === "C++"
          ? /虚函数|多态|继承/.test(haystack)
            ? ["类与对象", "继承与多态"]
            : []
          : [];
  return {
    title,
    moduleHint,
    topicPath,
    aliases: [],
    summary,
    sections: {
      definition: summary,
      purpose: "用于理解并复习当前知识点。",
      implementation: cleaned.slice(0, 5000),
      useCases: "复习、搜索与问答测试。",
      rationale: "来自当天学习笔记，需要在后续学习中补充联系。",
      advantages: "保留原始知识语境。",
      disadvantages: "尚未经过充分归纳，可能需要后续补全。",
      relatedPoints: "等待更多笔记建立关联。",
      differences: "等待相近知识点导入后补充。"
    },
    relatedTitles: [],
    sourceExcerpts: [cleaned.slice(0, 4000)],
    originalQuestions: []
  };
}
