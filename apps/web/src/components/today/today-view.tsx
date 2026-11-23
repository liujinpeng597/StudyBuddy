"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, ChevronRight, GitBranch, Sparkles } from "lucide-react";

type Job = {
  id: string;
  status: string;
  progress: number;
  studyDate?: string;
  errorMessage: string | null;
  summary: IntegrationSummary | null;
  questionStatus?: string;
  assets?: Array<{ id: string; type: string; fileName: string }>;
};

type IntegrationSummary = {
  createdNodes?: Array<{ id: string; title: string }>;
  updatedNodes?: Array<{ id: string; title: string }>;
  newRelations?: Array<{ source: string; target: string; type: string }>;
  needsReview?: Array<{ id: string; title: string }>;
  sourceCount?: number;
  problemCount?: number;
  questionCount?: number;
};

export function TodayView() {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/imports/latest");
        if (!response.ok) throw new Error("无法读取最近导入");
        const data = (await response.json()) as Job | null;
        if (!active) return;
        setJob(data);
        if (
          data?.id &&
          (!["completed", "failed", "undone"].includes(data.status) ||
            data.questionStatus === "processing")
        ) {
          const detail = await fetch(`/api/imports/${data.id}`);
          if (detail.ok && active) setJob((await detail.json()) as Job);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "加载失败");
      }
    };
    void load();
    const timer = setInterval(load, 2500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (error) return <p className="error-text">{error}</p>;
  if (!job) {
    return (
      <EmptyImport
        title="知识树正在等待第一份笔记"
        description="导入今天的 Markdown 和 LeetCode 截图，知伴会整理成可复习的知识网络。"
      />
    );
  }
  if (!["completed", "failed", "undone"].includes(job.status)) {
    return (
      <section className="stack">
        <header className="page-header">
          <div>
            <h1 className="page-title">正在整理 {job.studyDate}</h1>
            <p className="page-subtitle">可以继续浏览旧知识，后台任务不会中断。</p>
          </div>
          <span className="badge attention">{stageLabel(job.status)}</span>
        </header>
        <div className="panel panel-body stack">
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${Math.max(5, job.progress)}%` }} />
          </div>
          <p className="muted">
            {stageLabel(job.status)} · {job.progress}%
          </p>
        </div>
      </section>
    );
  }
  if (job.status === "failed") {
    return (
      <section className="stack">
        <header className="page-header">
          <div>
            <h1 className="page-title">这次导入未完成</h1>
            <p className="page-subtitle">原始文件仍然安全保留，可以重新提交或检查模型设置。</p>
          </div>
          <Link className="button" href="/settings/models">
            检查模型
          </Link>
        </header>
        <div className="panel panel-body error-text">{job.errorMessage ?? "未知错误"}</div>
      </section>
    );
  }
  if (job.status === "undone") {
    return (
      <section className="stack">
        <header className="page-header">
          <div>
            <h1 className="page-title">这次导入已撤销</h1>
            <p className="page-subtitle">原始来源仍保留在后台，但本次产生的知识变更已回滚。</p>
          </div>
          <Link className="button" href="/imports?new=1">
            重新导入
          </Link>
        </header>
      </section>
    );
  }

  const summary = job.summary ?? {};
  return (
    <section className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">{job.studyDate} 今日整合</h1>
          <p className="page-subtitle">
            内容已经合并进全局知识网络。来源只用于追溯，不作为每日独立笔记展示。
          </p>
          {job.questionStatus === "processing" ? (
            <p className="muted">复习题仍在后台生成，可以先浏览知识网络。</p>
          ) : null}
        </div>
        <Link className="button" href="/review">
          开始测试 <ArrowRight size={16} />
        </Link>
      </header>
      <div className="grid-two">
        <Metric icon={<GitBranch />} value={summary.newRelations?.length ?? 0} label="新增关联" />
        <Metric
          icon={<BookOpen />}
          value={(summary.createdNodes?.length ?? 0) + (summary.updatedNodes?.length ?? 0)}
          label="知识节点变化"
        />
        <Metric icon={<Sparkles />} value={summary.questionCount ?? 0} label="复习题" />
        <Metric icon={<BookOpen />} value={summary.problemCount ?? 0} label="LeetCode 档案" />
      </div>
      {summary.createdNodes?.length || summary.updatedNodes?.length ? (
        <details className="panel today-disclosure">
          <summary className="today-disclosure-summary">
            <span>
              <strong>今日织入</strong>
              <span className="badge">
                {(summary.createdNodes?.length ?? 0) + (summary.updatedNodes?.length ?? 0)} 个知识点
              </span>
            </span>
            <ChevronRight
              aria-hidden="true"
              className="today-disclosure-chevron"
              size={17}
              strokeWidth={1.5}
            />
          </summary>
          <div className="panel-body">
            <div className="today-disclosure-action">
              <Link href="/graph" className="badge accent">
                查看知识图
              </Link>
            </div>
            <ul className="list">
              {[...(summary.createdNodes ?? []), ...(summary.updatedNodes ?? [])].map((node) => (
                <li className="list-item" key={node.id}>
                  <Link href={`/knowledge/${node.id}`}>{node.title}</Link>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
      {summary.newRelations?.length ? (
        <details className="panel today-disclosure">
          <summary className="today-disclosure-summary">
            <span>
              <strong>串起来的联系</strong>
              <span className="badge">{summary.newRelations.length} 条</span>
            </span>
            <ChevronRight
              aria-hidden="true"
              className="today-disclosure-chevron"
              size={17}
              strokeWidth={1.5}
            />
          </summary>
          <div className="panel-body">
            <ul className="list">
              {summary.newRelations.map((relation, index) => (
                <li className="list-item" key={`${relation.source}-${relation.target}-${index}`}>
                  {relation.source} <span className="muted">→ {relationLabel(relation.type)} →</span>{" "}
                  {relation.target}
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}
    </section>
  );
}

function EmptyImport({ title, description }: { title: string; description: string }) {
  return (
    <div className="panel empty-state">
      <div className="empty-state-inner">
        <BookOpen size={34} color="var(--accent)" />
        <h2>{title}</h2>
        <p>{description}</p>
        <Link className="button primary" href="/imports?new=1">
          导入当天笔记
        </Link>
      </div>
    </div>
  );
}

function Metric({
  icon,
  value,
  label
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="panel panel-body">
      <span style={{ color: "var(--accent)" }}>{icon}</span>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div className="muted">{label}</div>
    </div>
  );
}

function stageLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "排队中",
    parsing: "解析来源",
    extracting: "AI 整理",
    resolving: "合并旧知识",
    committing: "写入知识网络",
    completed: "已完成",
    failed: "失败",
    undone: "已撤销"
  };
  return labels[status] ?? status;
}

function relationLabel(type: string) {
  const labels: Record<string, string> = {
    prerequisite: "前置",
    part_of: "组成",
    related: "相关",
    contrast: "易混",
    applies_to: "应用"
  };
  return labels[type] ?? type;
}
