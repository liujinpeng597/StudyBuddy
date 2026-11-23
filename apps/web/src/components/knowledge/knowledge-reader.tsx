"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Code2,
  ExternalLink,
  FileText,
  GitCompareArrows,
  Image as ImageIcon,
  Lightbulb,
  Link2,
  Map as MapIcon,
  Target,
  Wrench
} from "lucide-react";

type SectionKey =
  | "definition"
  | "purpose"
  | "implementation"
  | "useCases"
  | "rationale"
  | "advantages"
  | "disadvantages"
  | "relatedPoints"
  | "differences";

type Relation = {
  node_id: string;
  title: string;
  summary: string;
  type: string;
  direction: "in" | "out";
  review_status: string;
};

type KnowledgeData = {
  node: {
    id: string;
    canonical_title: string;
    summary: string;
    sections: Record<SectionKey, string>;
    review_status: string;
    module_name: string | null;
    module_path: string[];
  };
  relations: Relation[];
  sources: Array<{
    id: string;
    fileName: string;
    type: string;
    excerpt: string;
    question: string | null;
    imageUrl: string | null;
  }>;
  problems: Array<{
    id: string;
    title: string | null;
    number: number | null;
    description: string | null;
    code: string | null;
    language: string | null;
    data_structures: string[];
    algorithms: string[];
    complexity: { time?: string | null; space?: string | null };
    optimization_notes: string | null;
    inferred_fields: string[];
    incomplete_fields: string[];
  }>;
};

const attributeSections: Array<{
  key: SectionKey;
  title: string;
  description: string;
  icon: typeof Target;
}> = [
  { key: "purpose", title: "作用", description: "这个机制解决什么问题", icon: Target },
  { key: "implementation", title: "相关实现", description: "代码或系统层面的落地方式", icon: Wrench },
  { key: "useCases", title: "使用场合", description: "什么时候应该想到它", icon: MapIcon },
  { key: "rationale", title: "为什么使用", description: "设计取舍背后的理由", icon: Lightbulb }
];

export function KnowledgeReader({ nodeId }: { nodeId: string }) {
  const [data, setData] = useState<KnowledgeData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/knowledge/${nodeId}`, { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as KnowledgeData & { error?: string };
        if (!response.ok) throw new Error(body.error ?? "知识点加载失败");
        setData(body);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "知识点加载失败"));
  }, [nodeId]);

  if (error) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error}
      </div>
    );
  }
  if (!data) return <KnowledgeSkeleton />;

  const { node } = data;
  const relations = uniqueRelations(data.relations);
  const relationTitleSet = new Set(relations.map((relation) => relation.title));
  const standaloneRelated = splitRelatedPoints(node.sections.relatedPoints).filter(
    (point) => !relationTitleSet.has(point)
  );
  const comparison = buildComparison(node, relations);

  return (
    <article className="mx-auto max-w-4xl rounded-2xl bg-slate-50 px-4 py-5 text-slate-900 sm:px-6 sm:py-7">
      <nav className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500" aria-label="面包屑">
        <Link
          className="rounded-md px-1.5 py-1 transition-colors hover:bg-white hover:text-emerald-700"
          href="/graph"
        >
          知识库
        </Link>
        {node.module_path.map((item) => (
          <span className="flex items-center gap-1.5" key={item}>
            <ChevronRight aria-hidden="true" size={13} strokeWidth={1.5} />
            <span>{item}</span>
          </span>
        ))}
      </nav>

      <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-medium text-emerald-700">知识点复习页</p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-[2.5rem]">
            {node.canonical_title}
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-7 text-slate-600">{node.summary}</p>
        </div>
        {node.review_status === "needs_review" ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
            <AlertTriangle aria-hidden="true" size={14} strokeWidth={1.5} />
            待复核
          </span>
        ) : null}
      </header>

      <div className="mt-6 grid gap-5">
        <section>
          <SectionHeading
            description="先用一句话建立概念边界"
            icon={BookOpenCheck}
            number="01"
            title="核心定义"
          />
          <div className="mt-3 overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm">
            <div className="border-l-4 border-emerald-600 bg-emerald-50/60 px-6 py-5 sm:px-7">
              <MarkdownContent className="knowledge-definition">
                {node.sections.definition || "暂无定义"}
              </MarkdownContent>
            </div>
          </div>
        </section>

        <section>
          <SectionHeading
            description="把理解、实现和适用范围分开复习"
            icon={Target}
            number="02"
            title="属性与场景"
          />
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {attributeSections.map((section) => {
              const Icon = section.icon;
              return (
                <div
                  className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  key={section.key}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600">
                      <Icon aria-hidden="true" size={17} strokeWidth={1.5} />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-base font-semibold text-slate-800">{section.title}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">{section.description}</p>
                    </div>
                  </div>
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <MarkdownContent>{node.sections[section.key] || "暂无内容"}</MarkdownContent>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section>
          <SectionHeading
            description="同时记住收益和代价"
            icon={CheckCircle2}
            number="03"
            title="优缺点对照"
          />
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-2 text-emerald-800">
                <CheckCircle2 aria-hidden="true" size={18} strokeWidth={1.5} />
                <h2 className="text-base font-semibold">优点</h2>
              </div>
              <div className="mt-3">
                <MarkdownContent>{node.sections.advantages || "暂无内容"}</MarkdownContent>
              </div>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle aria-hidden="true" size={18} strokeWidth={1.5} />
                <h2 className="text-base font-semibold">缺点与风险</h2>
              </div>
              <div className="mt-3">
                <MarkdownContent>{node.sections.disadvantages || "暂无内容"}</MarkdownContent>
              </div>
            </div>
          </div>
        </section>

        <section>
          <SectionHeading
            description="点击标签继续追踪概念"
            icon={Link2}
            number="04"
            title="相关知识点"
          />
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap gap-2">
              {relations.map((relation) => (
                <Link
                  className="group inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 transition-colors duration-150 hover:border-blue-200 hover:bg-blue-100"
                  href={`/knowledge/${relation.node_id}`}
                  key={`relation-${relation.node_id}`}
                  title={relation.summary}
                >
                  {relation.title}
                  <ChevronRight
                    aria-hidden="true"
                    className="text-blue-500 transition-transform duration-150 group-hover:translate-x-0.5"
                    size={13}
                    strokeWidth={1.5}
                  />
                </Link>
              ))}
              {standaloneRelated.map((point) => (
                <Link
                  className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 transition-colors duration-150 hover:border-blue-200 hover:bg-blue-100"
                  href={`/graph?focus=${encodeURIComponent(point)}`}
                  key={`point-${point}`}
                  title={`在知识图谱中查看 ${point}`}
                >
                  {point}
                  <ExternalLink aria-hidden="true" size={12} strokeWidth={1.5} />
                </Link>
              ))}
              {!relations.length && !standaloneRelated.length ? (
                <p className="text-sm text-slate-500">还没有建立相关知识点</p>
              ) : null}
            </div>
          </div>
        </section>

        <section>
          <SectionHeading
            description="用对比维度替代整段文字"
            icon={GitCompareArrows}
            number="05"
            title="相近知识点对比"
          />
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {comparison.kind === "markdown" ? (
              <div className="p-5 sm:p-6">
                <MarkdownContent className="knowledge-comparison">
                  {node.sections.differences}
                </MarkdownContent>
              </div>
            ) : (
              <div className="overflow-x-auto p-4 sm:p-6">
                <table className="w-full min-w-[620px] border-collapse overflow-hidden text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="w-32 border border-slate-200 px-4 py-3 font-medium text-slate-600">
                        对比维度
                      </th>
                      <th className="border border-slate-200 px-4 py-3 font-medium text-slate-800">
                        {comparison.leftLabel}
                      </th>
                      <th className="border border-slate-200 px-4 py-3 font-medium text-slate-800">
                        {comparison.rightLabel}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <th className="border border-slate-200 px-4 py-4 text-left font-medium text-slate-500">
                        核心定位
                      </th>
                      <td className="border border-slate-200 px-4 py-4 leading-6 text-slate-600">
                        {node.summary}
                      </td>
                      <td className="border border-slate-200 px-4 py-4 leading-6 text-slate-600">
                        {comparison.rightSummary}
                      </td>
                    </tr>
                    <tr className="bg-slate-50">
                      <th className="border border-slate-200 px-4 py-4 text-left font-medium text-slate-500">
                        关键差异
                      </th>
                      <td className="border border-slate-200 px-4 py-4 leading-6 text-slate-700">
                        {comparison.leftDifference}
                      </td>
                      <td className="border border-slate-200 px-4 py-4 leading-6 text-slate-700">
                        {comparison.rightDifference}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {data.problems.length ? (
          <section>
            <SectionHeading
              description="题目关联的算法与优化记录"
              icon={Code2}
              number="06"
              title="LeetCode 档案"
            />
            <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              {data.problems.map((problem) => (
                <article className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={problem.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium text-slate-800">
                        {problem.number ? `${problem.number}. ` : ""}
                        {problem.title ?? "未识别题目"}
                      </h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[...problem.data_structures, ...problem.algorithms].map((item) => (
                          <span
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                            key={item}
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                    {problem.complexity.time || problem.complexity.space ? (
                      <div className="font-mono text-xs tabular-nums text-slate-500">
                        {problem.complexity.time ? `T ${problem.complexity.time}` : ""}
                        {problem.complexity.time && problem.complexity.space ? " · " : ""}
                        {problem.complexity.space ? `S ${problem.complexity.space}` : ""}
                      </div>
                    ) : null}
                  </div>
                  {problem.code ? (
                    <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-6 text-slate-100">
                      <code>{problem.code}</code>
                    </pre>
                  ) : null}
                  {problem.optimization_notes ? (
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      优化方向：{problem.optimization_notes}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {data.sources.length ? (
          <section>
            <SectionHeading
              description={`${data.sources.length} 条原始笔记或截图`}
              icon={FileText}
              number={data.problems.length ? "07" : "06"}
              title="来源依据"
            />
            <details className="group mt-3 rounded-xl border border-slate-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 sm:px-6">
                <span className="min-w-0 flex-1 text-sm text-slate-600">展开查看原始来源</span>
                <ChevronRight
                  aria-hidden="true"
                  className="text-slate-400 transition-transform duration-150 group-open:rotate-90"
                  size={17}
                  strokeWidth={1.5}
                />
              </summary>
              <div className="grid gap-3 border-t border-slate-200 p-4 sm:p-5">
                {data.sources.map((source) => (
                  <article className="rounded-lg border border-slate-200 bg-slate-50 p-4" key={source.id}>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      {source.type === "image" ? (
                        <ImageIcon aria-hidden="true" size={16} strokeWidth={1.5} />
                      ) : (
                        <FileText aria-hidden="true" size={16} strokeWidth={1.5} />
                      )}
                      {source.fileName}
                    </div>
                    {source.imageUrl ? (
                      <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          alt={`来源截图 ${source.fileName}`}
                          className="block h-auto max-w-full"
                          src={source.imageUrl}
                        />
                      </div>
                    ) : (
                      <p className="mt-2 text-sm leading-6 text-slate-600">{source.excerpt}</p>
                    )}
                  </article>
                ))}
              </div>
            </details>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function SectionHeading({
  icon: Icon,
  number,
  title,
  description
}: {
  icon: typeof Target;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] tabular-nums text-emerald-700">{number}</span>
      <span className="grid size-8 place-items-center rounded-lg bg-slate-100 text-slate-600">
        <Icon aria-hidden="true" size={17} strokeWidth={1.5} />
      </span>
      <span className="min-w-0">
        <span className="block text-base font-semibold text-slate-800">{title}</span>
        <span className="block text-xs text-slate-500">{description}</span>
      </span>
    </div>
  );
}

function MarkdownContent({
  children,
  className = ""
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        components={{
          h1: ({ children: content }) => (
            <h3 className="mb-2 text-lg font-semibold text-slate-800">{content}</h3>
          ),
          h2: ({ children: content }) => (
            <h3 className="mb-2 text-base font-semibold text-slate-800">{content}</h3>
          ),
          h3: ({ children: content }) => (
            <h4 className="mb-2 font-medium text-slate-800">{content}</h4>
          ),
          p: ({ children: content }) => (
            <p className="text-[15px] leading-7 text-slate-600 [&:not(:first-child)]:mt-3">
              {content}
            </p>
          ),
          ul: ({ children: content }) => (
            <ul className="my-2 list-disc space-y-2 pl-5 text-[15px] leading-7 text-slate-600">
              {content}
            </ul>
          ),
          ol: ({ children: content }) => (
            <ol className="my-2 list-decimal space-y-2 pl-5 text-[15px] leading-7 text-slate-600">
              {content}
            </ol>
          ),
          li: ({ children: content }) => <li className="pl-0.5">{content}</li>,
          strong: ({ children: content }) => (
            <strong className="font-medium text-slate-800">{content}</strong>
          ),
          code: ({ children: content, className: codeClassName }) =>
            codeClassName ? (
              <code className="block overflow-x-auto rounded-lg bg-slate-900 p-4 font-mono text-xs leading-6 text-slate-100">
                {content}
              </code>
            ) : (
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-700">
                {content}
              </code>
            ),
          pre: ({ children: content }) => <pre className="my-3">{content}</pre>,
          blockquote: ({ children: content }) => (
            <blockquote className="my-3 border-l-2 border-emerald-300 pl-4 text-slate-600">
              {content}
            </blockquote>
          ),
          table: ({ children: content }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-left text-sm">{content}</table>
            </div>
          ),
          th: ({ children: content }) => (
            <th className="border border-slate-200 bg-slate-100 px-3 py-2 font-medium text-slate-700">
              {content}
            </th>
          ),
          td: ({ children: content }) => (
            <td className="border border-slate-200 px-3 py-2 align-top leading-6 text-slate-600">
              {content}
            </td>
          ),
          a: ({ children: content, href }) => (
            <a
              className="font-medium text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-800"
              href={href}
            >
              {content}
            </a>
          )
        }}
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

function KnowledgeSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 rounded-2xl bg-slate-50 p-6">
      <div className="h-3 w-44 rounded bg-slate-200" />
      <div className="h-10 w-2/3 rounded-lg bg-slate-200" />
      <div className="h-4 w-full rounded bg-slate-200" />
      <div className="h-40 rounded-xl bg-white shadow-sm" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-36 rounded-xl bg-white shadow-sm" />
        <div className="h-36 rounded-xl bg-white shadow-sm" />
      </div>
    </div>
  );
}

function splitRelatedPoints(value: string) {
  return [
    ...new Set(
      value
        .split(/[、，,；;]/)
        .map((item) =>
          item
            .replace(/^(与|和)/, "")
            .replace(/相关$/, "")
            .trim()
        )
        .filter(Boolean)
    )
  ].slice(0, 12);
}

function uniqueRelations(relations: Relation[]) {
  const seen = new Set<string>();
  return relations.filter((relation) => {
    if (seen.has(relation.node_id)) return false;
    seen.add(relation.node_id);
    return true;
  });
}

function buildComparison(
  node: KnowledgeData["node"],
  relations: Relation[]
):
  | { kind: "markdown" }
  | {
      kind: "table";
      leftLabel: string;
      rightLabel: string;
      rightSummary: string;
      leftDifference: string;
      rightDifference: string;
    } {
  const differences = node.sections.differences.trim();
  if (/\|.+\|/.test(differences) && /\n\s*\|?\s*:?-{3,}/.test(differences)) {
    return { kind: "markdown" };
  }
  const titleMatch = node.canonical_title.match(/^(.+?)(?:与|和| vs | VS )(.+)$/);
  const leftLabel = titleMatch?.[1]?.trim() ?? node.canonical_title;
  const rightLabel = titleMatch?.[2]?.trim() ?? relations[0]?.title ?? "相关概念";
  const leftToken = stripDomainPrefix(leftLabel);
  const rightToken = stripDomainPrefix(rightLabel);
  const clauses = differences
    .split(/[。；;]/)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const leftClauses = clauses.filter((clause) => clause.includes(leftToken));
  const rightClauses = clauses.filter((clause) => clause.includes(rightToken));
  const definitionClauses = node.sections.definition
    .split(/[。；;]/)
    .map((clause) => clause.trim())
    .filter(Boolean);
  const rightDefinition =
    definitionClauses.find((clause) => clause.includes(rightToken)) ??
    definitionClauses.find((clause) => clause.includes(rightLabel));
  const matchingRelation = relations.find((relation) => relation.title === rightLabel);
  return {
    kind: "table",
    leftLabel,
    rightLabel,
    rightSummary:
      matchingRelation?.summary ??
      rightDefinition ??
      "查看关联知识点继续补充",
    leftDifference: leftClauses.length ? leftClauses.join("；") : differences || "暂无差异记录",
    rightDifference: rightClauses.length
      ? rightClauses.join("；")
      : "差异内容已合并记录，可结合右侧相关知识点复习"
  };
}

function stripDomainPrefix(value: string) {
  return value.replace(/^[A-Za-z0-9+#.\s]+/, "").trim() || value;
}
