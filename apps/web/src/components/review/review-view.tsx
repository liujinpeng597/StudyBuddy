"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Clock3,
  History,
  LoaderCircle,
  Plus,
  RefreshCw,
  RotateCcw,
  XCircle
} from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "fill_blank"
  | "true_false"
  | "short_answer";

type Question = {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  answerKey: string | string[] | null;
  correctIndexes: number[];
  explanation: string;
  rubric: string[];
  sourceNodeIds: string[];
  sourceTitle: string | null;
};

type Feedback = {
  correct?: boolean;
  explanation?: string;
  correctAnswer?: unknown;
  ai?: boolean;
  evaluation?: {
    coveredPoints: string[];
    missingPoints: string[];
    incorrectPoints: string[];
    clarityFeedback: string;
    score: number;
    confidence: number;
  };
  lowConfidence?: boolean;
  unavailable?: boolean;
  message?: string;
  rubric?: string[];
};

type AttemptRecord = {
  id: string;
  questionId: string;
  jobId: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  answerKey: unknown;
  correctIndexes: number[];
  explanation: string;
  rubric: string[];
  sourceTitle: string | null;
  answer: unknown;
  score: number | null;
  feedback: Record<string, unknown>;
  createdAt: string;
  isCorrect: boolean | null;
};

type Tab = "practice" | "mistakes" | "history";

const tabs: Array<{ id: Tab; label: string; icon: typeof ClipboardList }> = [
  { id: "practice", label: "今日测试", icon: ClipboardList },
  { id: "mistakes", label: "错题表", icon: CircleAlert },
  { id: "history", label: "作答记录", icon: History }
];

export function ReviewView() {
  const { showToast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attempts, setAttempts] = useState<AttemptRecord[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("practice");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState("");

  async function loadData() {
    const [questionResponse, attemptResponse] = await Promise.all([
      fetch("/api/questions", { cache: "no-store" }),
      fetch("/api/attempts?limit=500", { cache: "no-store" })
    ]);
    const questionData = (await questionResponse.json()) as {
      questions?: Question[];
      error?: string;
    };
    const attemptData = (await attemptResponse.json()) as {
      attempts?: AttemptRecord[];
      error?: string;
    };
    if (!questionResponse.ok) throw new Error(questionData.error ?? "题目加载失败");
    if (!attemptResponse.ok) throw new Error(attemptData.error ?? "作答记录加载失败");
    setQuestions(questionData.questions ?? []);
    setAttempts(attemptData.attempts ?? []);
  }

  useEffect(() => {
    void Promise.resolve()
      .then(loadData)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "测试加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const latestAttempts = useMemo(() => latestAttemptsByQuestion(attempts), [attempts]);
  const latestByQuestion = useMemo(
    () => new Map(latestAttempts.map((attempt) => [attempt.questionId, attempt])),
    [latestAttempts]
  );
  const mistakes = useMemo(
    () => latestAttempts.filter((attempt) => attempt.isCorrect === false),
    [latestAttempts]
  );
  const answeredCount = useMemo(
    () => questions.filter((question) => latestByQuestion.has(question.id)).length,
    [questions, latestByQuestion]
  );
  const correctCount = useMemo(
    () =>
      questions.filter((question) => latestByQuestion.get(question.id)?.isCorrect === true)
        .length,
    [questions, latestByQuestion]
  );
  const currentQuestion = questions[currentIndex] ?? null;
  const currentAttempt = currentQuestion
    ? latestByQuestion.get(currentQuestion.id)
    : undefined;

  async function refreshAttempts() {
    const response = await fetch("/api/attempts?limit=500", { cache: "no-store" });
    const data = (await response.json()) as { attempts?: AttemptRecord[]; error?: string };
    if (!response.ok) throw new Error(data.error ?? "作答记录刷新失败");
    setAttempts(data.attempts ?? []);
  }

  async function submit(question: Question) {
    setBusy(question.id);
    try {
      const response = await fetch("/api/attempts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: question.id,
          answer: answers[question.id] ?? ""
        })
      });
      const data = (await response.json()) as Feedback & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "提交失败");
      setFeedback((current) => ({ ...current, [question.id]: data }));
      await refreshAttempts();
      if (data.correct === false || (data.evaluation && data.evaluation.score < 3.5)) {
        showToast("本题已加入错题表，可以稍后集中重练。", "info");
      } else {
        showToast("作答已保存。");
      }
    } catch (cause) {
      setFeedback((current) => ({
        ...current,
        [question.id]: { message: cause instanceof Error ? cause.message : "提交失败" }
      }));
    } finally {
      setBusy(null);
    }
  }

  async function generateMore() {
    setGenerating(true);
    try {
      const response = await fetch("/api/questions/generate", { method: "POST" });
      const data = (await response.json()) as { created?: number; error?: string };
      if (!response.ok) throw new Error(data.error ?? "新题生成失败");
      await loadData();
      showToast(`已根据当前知识网络新增 ${data.created ?? 0} 道题。`);
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "新题生成失败", "error");
    } finally {
      setGenerating(false);
    }
  }

  async function retryAttempt(attempt: AttemptRecord) {
    let targetQuestions = questions;
    let index = targetQuestions.findIndex((question) => question.id === attempt.questionId);
    if (index < 0) {
      setBusy("retry");
      try {
        const response = await fetch(`/api/questions?jobId=${encodeURIComponent(attempt.jobId)}`, {
          cache: "no-store"
        });
        const data = (await response.json()) as { questions?: Question[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "原题加载失败");
        targetQuestions = data.questions ?? [];
        index = targetQuestions.findIndex((question) => question.id === attempt.questionId);
        setQuestions(targetQuestions);
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : "原题加载失败", "error");
        setBusy(null);
        return;
      }
      setBusy(null);
    }
    if (index >= 0) setCurrentIndex(index);
    setFeedback((current) => {
      const next = { ...current };
      delete next[attempt.questionId];
      return next;
    });
    setTab("practice");
  }

  function moveQuestion(direction: -1 | 1) {
    setCurrentIndex((index) =>
      Math.max(0, Math.min(questions.length - 1, index + direction))
    );
  }

  function moveToNextUnanswered() {
    const next = questions.findIndex(
      (question, index) => index > currentIndex && !latestByQuestion.has(question.id)
    );
    if (next >= 0) setCurrentIndex(next);
    else moveQuestion(1);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-5xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-5xl rounded-2xl bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-7">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="mb-1.5 text-xs font-medium text-emerald-700">知识检验</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">测试与错题</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            每次作答都会保留。先完成今日测试，再到错题表集中处理薄弱知识点。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm transition-colors hover:bg-slate-100"
            type="button"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              void Promise.resolve()
                .then(loadData)
                .catch((cause) =>
                  showToast(cause instanceof Error ? cause.message : "刷新失败", "error")
                )
                .finally(() => setLoading(false));
            }}
          >
            <RefreshCw size={16} strokeWidth={1.5} />
            刷新
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-3.5 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={generating}
            onClick={generateMore}
          >
            {generating ? (
              <LoaderCircle className="animate-spin" size={16} strokeWidth={1.5} />
            ) : (
              <Plus size={16} strokeWidth={1.5} />
            )}
            {generating ? "正在生成" : "生成新题"}
          </button>
        </div>
      </header>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Metric label="题目" value={questions.length} />
        <Metric label="已答" value={answeredCount} />
        <Metric label="错题" value={mistakes.length} tone="danger" />
      </div>

      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-slate-200" role="tablist">
        {tabs.map((item) => {
          const Icon = item.icon;
          const count =
            item.id === "mistakes"
              ? mistakes.length
              : item.id === "history"
                ? attempts.length
                : questions.length;
          return (
            <button
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors ${
                tab === item.id
                  ? "border-emerald-700 font-medium text-slate-950"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              <Icon size={16} strokeWidth={1.5} />
              {item.label}
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-slate-500">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === "practice" ? (
          loading ? (
            <LoadingPanel />
          ) : currentQuestion ? (
            <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
              <aside className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>答题进度</span>
                  <span className="font-mono tabular-nums">
                    {answeredCount}/{questions.length}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-[width] duration-300"
                    style={{
                      width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%`
                    }}
                  />
                </div>
                <div className="mt-4 grid grid-cols-6 gap-2 lg:grid-cols-5">
                  {questions.map((question, index) => {
                    const attempt = latestByQuestion.get(question.id);
                    const active = index === currentIndex;
                    return (
                      <button
                        className={`grid size-8 place-items-center rounded-md border font-mono text-xs tabular-nums transition-colors ${
                          active
                            ? "border-slate-900 bg-slate-900 text-white"
                            : attempt?.isCorrect === true
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : attempt?.isCorrect === false
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                        }`}
                        key={question.id}
                        type="button"
                        aria-label={`第 ${index + 1} 题`}
                        aria-current={active ? "step" : undefined}
                        onClick={() => setCurrentIndex(index)}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500">
                  <Legend className="bg-emerald-500" label={`答对 ${correctCount}`} />
                  <Legend className="bg-red-500" label={`错题 ${mistakes.length}`} />
                  <Legend className="bg-slate-300" label="未作答" />
                </div>
              </aside>

              <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-900 px-2 py-1 font-mono text-xs tabular-nums text-white">
                      {String(currentIndex + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm font-medium text-slate-700">
                      {typeLabel(currentQuestion.type)}
                    </span>
                  </div>
                  {currentQuestion.sourceNodeIds[0] ? (
                    <a
                      className="text-xs text-emerald-700 hover:text-emerald-800"
                      href={`/knowledge/${currentQuestion.sourceNodeIds[0]}`}
                    >
                      {currentQuestion.sourceTitle ?? "查看来源"}
                    </a>
                  ) : null}
                </div>
                <div className="p-5 sm:p-6">
                  <h2 className="text-xl font-semibold leading-8 text-slate-900">
                    {currentQuestion.prompt}
                  </h2>
                  <div className="mt-5">
                    {renderAnswerControl(
                      currentQuestion,
                      answers[currentQuestion.id],
                      (value) =>
                        setAnswers((current) => ({
                          ...current,
                          [currentQuestion.id]: value
                        }))
                    )}
                  </div>
                  {feedback[currentQuestion.id] ? (
                    <AnswerFeedback
                      feedback={feedback[currentQuestion.id]!}
                      question={currentQuestion}
                    />
                  ) : currentAttempt ? (
                    <PreviousAttempt attempt={currentAttempt} />
                  ) : null}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
                    <div className="flex gap-2">
                      <button
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
                        type="button"
                        disabled={currentIndex === 0}
                        onClick={() => moveQuestion(-1)}
                      >
                        <ArrowLeft size={15} strokeWidth={1.5} />
                        上一题
                      </button>
                      <button
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
                        type="button"
                        disabled={currentIndex === questions.length - 1}
                        onClick={() => moveQuestion(1)}
                      >
                        下一题
                        <ArrowRight size={15} strokeWidth={1.5} />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      {feedback[currentQuestion.id] ? (
                        <button
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm text-emerald-800 transition-colors hover:bg-emerald-100"
                          type="button"
                          onClick={moveToNextUnanswered}
                        >
                          下一道未答题
                          <ArrowRight size={15} strokeWidth={1.5} />
                        </button>
                      ) : null}
                      <button
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                        type="button"
                        disabled={
                          busy === currentQuestion.id || !hasAnswer(answers[currentQuestion.id])
                        }
                        onClick={() => submit(currentQuestion)}
                      >
                        {busy === currentQuestion.id ? (
                          <LoaderCircle className="animate-spin" size={15} strokeWidth={1.5} />
                        ) : (
                          <Check size={15} strokeWidth={1.5} />
                        )}
                        提交答案
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            </div>
          ) : (
            <EmptyQuestions onGenerate={generateMore} generating={generating} />
          )
        ) : null}

        {tab === "mistakes" ? (
          <MistakeTable
            attempts={mistakes}
            busy={busy === "retry"}
            onRetry={retryAttempt}
          />
        ) : null}

        {tab === "history" ? <AttemptHistory attempts={attempts} /> : null}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone = "default"
}: {
  label: string;
  value: number;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs text-slate-500">{label}</div>
      <div
        className={`mt-1 font-mono text-2xl tabular-nums ${
          tone === "danger" && value > 0 ? "text-red-700" : "text-slate-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`size-2 rounded-full ${className}`} />
      {label}
    </div>
  );
}

function renderAnswerControl(
  question: Question,
  value: string | string[] | undefined,
  onChange: (value: string | string[]) => void
) {
  if (question.type === "short_answer") {
    return (
      <textarea
        className="min-h-36 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] leading-7 text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="按定义、作用、机制和适用场景组织回答"
      />
    );
  }
  if (question.type === "fill_blank") {
    return (
      <input
        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-[15px] text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white"
        value={typeof value === "string" ? value : ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="填写答案"
      />
    );
  }
  const multiple = question.type === "multiple_choice";
  const selected = Array.isArray(value) ? value : [];
  return (
    <div className="grid gap-2.5">
      {question.options.map((option, index) => {
        const active = multiple ? selected.includes(String(index)) : value === String(index);
        return (
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-[15px] leading-6 transition-colors ${
              active
                ? "border-emerald-300 bg-emerald-50 text-slate-900"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
            key={`${question.id}-${index}`}
          >
            <input
              className="mt-1 accent-emerald-700"
              type={multiple ? "checkbox" : "radio"}
              name={question.id}
              checked={active}
              onChange={(event) => {
                if (multiple) {
                  onChange(
                    event.target.checked
                      ? [...selected, String(index)]
                      : selected.filter((item) => item !== String(index))
                  );
                } else {
                  onChange(String(index));
                }
              }}
            />
            <span>{option}</span>
          </label>
        );
      })}
    </div>
  );
}

function AnswerFeedback({ feedback, question }: { feedback: Feedback; question: Question }) {
  if (feedback.message && !feedback.evaluation && !feedback.unavailable) {
    return <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">{feedback.message}</div>;
  }
  if (feedback.correct !== undefined) {
    return (
      <div
        className={`mt-4 rounded-xl border p-4 ${
          feedback.correct
            ? "border-emerald-200 bg-emerald-50"
            : "border-red-200 bg-red-50"
        }`}
      >
        <div
          className={`flex items-center gap-2 text-sm font-medium ${
            feedback.correct ? "text-emerald-800" : "text-red-800"
          }`}
        >
          {feedback.correct ? (
            <CheckCircle2 size={18} strokeWidth={1.5} />
          ) : (
            <XCircle size={18} strokeWidth={1.5} />
          )}
          {feedback.correct ? "回答正确" : "回答不正确"}
        </div>
        {!feedback.correct ? (
          <p className="mt-2 text-sm text-red-800">
            正确答案：{formatCorrectAnswer(question, feedback.correctAnswer)}
          </p>
        ) : null}
        <p className="mt-2 text-sm leading-6 text-slate-700">{feedback.explanation}</p>
      </div>
    );
  }
  if (feedback.evaluation) {
    const evaluation = feedback.evaluation;
    return (
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm text-slate-800">AI 评分 {evaluation.score} / 5</strong>
          {feedback.lowConfidence ? (
            <span className="text-xs text-amber-700">低置信度，请对照评分要点</span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 text-sm leading-6 text-slate-700">
          <p>
            <span className="font-medium text-slate-900">已覆盖：</span>
            {evaluation.coveredPoints.join("；") || "暂无"}
          </p>
          <p>
            <span className="font-medium text-slate-900">遗漏：</span>
            {evaluation.missingPoints.join("；") || "暂无"}
          </p>
          <p>
            <span className="font-medium text-slate-900">表达建议：</span>
            {evaluation.clarityFeedback}
          </p>
        </div>
      </div>
    );
  }
  if (feedback.unavailable) {
    return (
      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
          <AlertTriangle size={17} strokeWidth={1.5} />
          {feedback.message}
        </div>
        {feedback.rubric?.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-900">
            {feedback.rubric.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }
  return null;
}

function PreviousAttempt({ attempt }: { attempt: AttemptRecord }) {
  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      上次作答：
      <span className="ml-1 text-slate-800">{formatAttemptAnswer(attempt.answer, attempt.options)}</span>
      <span className="ml-2 text-xs text-slate-500">
        {formatDate(attempt.createdAt)}
      </span>
    </div>
  );
}

function MistakeTable({
  attempts,
  busy,
  onRetry
}: {
  attempts: AttemptRecord[];
  busy: boolean;
  onRetry: (attempt: AttemptRecord) => void;
}) {
  if (!attempts.length) {
    return (
      <EmptyPanel
        icon={<CheckCircle2 size={24} strokeWidth={1.5} />}
        title="当前没有错题"
        description="完成测试后，答错或得分低于 3.5 的问答题会出现在这里。"
      />
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="font-semibold text-slate-800">错题表</h2>
          <p className="mt-0.5 text-xs text-slate-500">按每道题最近一次作答统计</p>
        </div>
        <span className="font-mono text-xl tabular-nums text-red-700">{attempts.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">知识点</th>
              <th className="px-4 py-3 font-medium">题目</th>
              <th className="px-4 py-3 font-medium">你的答案</th>
              <th className="px-4 py-3 font-medium">正确答案 / 评分</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((attempt, index) => (
              <tr
                className={index % 2 ? "bg-slate-50/70" : "bg-white"}
                key={attempt.id}
              >
                <td className="border-t border-slate-100 px-4 py-4 align-top">
                  <div className="font-medium text-slate-700">{attempt.sourceTitle ?? "未关联"}</div>
                  <div className="mt-1 text-xs text-slate-500">{typeLabel(attempt.type)}</div>
                </td>
                <td className="max-w-xs border-t border-slate-100 px-4 py-4 align-top leading-6 text-slate-700">
                  {attempt.prompt}
                </td>
                <td className="border-t border-slate-100 px-4 py-4 align-top leading-6 text-red-700">
                  {formatAttemptAnswer(attempt.answer, attempt.options)}
                </td>
                <td className="border-t border-slate-100 px-4 py-4 align-top leading-6 text-slate-600">
                  {attempt.type === "short_answer"
                    ? `评分 ${attempt.score ?? 0} / 5`
                    : formatAttemptCorrectAnswer(attempt)}
                </td>
                <td className="border-t border-slate-100 px-4 py-4 text-right align-top">
                  <button
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
                    type="button"
                    disabled={busy}
                    onClick={() => onRetry(attempt)}
                  >
                    <RotateCcw size={13} strokeWidth={1.5} />
                    重练
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttemptHistory({ attempts }: { attempts: AttemptRecord[] }) {
  if (!attempts.length) {
    return (
      <EmptyPanel
        icon={<Clock3 size={24} strokeWidth={1.5} />}
        title="还没有作答记录"
        description="每次提交都会保存，包括原题、你的答案、评分和解析。"
      />
    );
  }
  return (
    <div className="grid gap-3">
      {attempts.map((attempt) => (
        <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" key={attempt.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{typeLabel(attempt.type)}</span>
                <span>·</span>
                <span>{attempt.sourceTitle ?? "未关联知识点"}</span>
                <span>·</span>
                <span className="font-mono tabular-nums">{formatDate(attempt.createdAt)}</span>
              </div>
              <h3 className="mt-2 font-medium leading-6 text-slate-800">{attempt.prompt}</h3>
            </div>
            <ResultBadge attempt={attempt} />
          </div>
          <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
            你的答案：{formatAttemptAnswer(attempt.answer, attempt.options)}
          </p>
        </article>
      ))}
    </div>
  );
}

function ResultBadge({ attempt }: { attempt: AttemptRecord }) {
  if (attempt.isCorrect === null) {
    return (
      <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
        待评分
      </span>
    );
  }
  return (
    <span
      className={`rounded-md border px-2 py-1 text-xs ${
        attempt.isCorrect
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {attempt.isCorrect ? "答对" : "答错"}
      {attempt.type === "short_answer" && attempt.score !== null
        ? ` · ${attempt.score}/5`
        : ""}
    </span>
  );
}

function EmptyQuestions({
  onGenerate,
  generating
}: {
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
      <div className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-500">
        <ClipboardList size={22} strokeWidth={1.5} />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-800">今天还没有测试题</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        可以基于当前知识网络生成一组新题，完成后会自动保存作答记录。
      </p>
      <button
        className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-60"
        type="button"
        disabled={generating}
        onClick={onGenerate}
      >
        {generating ? (
          <LoaderCircle className="animate-spin" size={16} strokeWidth={1.5} />
        ) : (
          <Plus size={16} strokeWidth={1.5} />
        )}
        生成测试题
      </button>
    </div>
  );
}

function EmptyPanel({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
      <div className="mx-auto grid size-11 place-items-center rounded-xl bg-slate-100 text-slate-500">
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold text-slate-800">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function LoadingPanel() {
  return (
    <div className="grid gap-4 lg:grid-cols-[210px_minmax(0,1fr)]">
      <div className="h-48 rounded-xl bg-white shadow-sm" />
      <div className="h-80 rounded-xl bg-white shadow-sm" />
    </div>
  );
}

function latestAttemptsByQuestion(attempts: AttemptRecord[]) {
  const seen = new Set<string>();
  return attempts.filter((attempt) => {
    if (seen.has(attempt.questionId)) return false;
    seen.add(attempt.questionId);
    return true;
  });
}

function hasAnswer(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value?.trim());
}

function formatCorrectAnswer(question: Question, value: unknown) {
  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return value.map((index) => question.options[index as number]).filter(Boolean).join("；");
  }
  if (Array.isArray(value)) return value.join("；");
  if (typeof value === "string" && question.options.length && /^\d+$/.test(value)) {
    return question.options[Number(value)] ?? value;
  }
  return typeof value === "string" ? value : question.answerKey?.toString() ?? "查看解析";
}

function formatAttemptCorrectAnswer(attempt: AttemptRecord) {
  if (attempt.correctIndexes.length) {
    return attempt.correctIndexes
      .map((index) => attempt.options[index])
      .filter(Boolean)
      .join("；");
  }
  if (Array.isArray(attempt.answerKey)) return attempt.answerKey.join("；");
  return typeof attempt.answerKey === "string" ? attempt.answerKey : "查看解析";
}

function formatAttemptAnswer(answer: unknown, options: string[]) {
  if (Array.isArray(answer)) {
    if (!answer.length) return "未作答";
    if (answer.every((item) => typeof item === "number" || /^\d+$/.test(String(item)))) {
      return answer
        .map((item) => options[Number(item)])
        .filter(Boolean)
        .join("；");
    }
    return answer.join("；");
  }
  if (typeof answer === "string") {
    if (options.length && /^\d+$/.test(answer)) return options[Number(answer)] ?? answer;
    return answer || "未作答";
  }
  return "未作答";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function typeLabel(type: QuestionType) {
  const labels: Record<QuestionType, string> = {
    single_choice: "单选",
    multiple_choice: "多选",
    fill_blank: "填空",
    true_false: "判断",
    short_answer: "问答"
  };
  return labels[type];
}
