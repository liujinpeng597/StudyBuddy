"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Plus, UploadCloud } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

type Job = {
  id: string;
  status: string;
  progress: number;
  studyDate: string;
  errorMessage: string | null;
  summary: {
    createdNodes?: Array<{ id: string; title: string }>;
    updatedNodes?: Array<{ id: string; title: string }>;
    newRelations?: Array<{ source: string; target: string; type: string }>;
    needsReview?: number;
    problemCount?: number;
    questionCount?: number;
    refinement?: {
      notesPolished?: number;
      correctedPoints?: number;
      uncertainPoints?: number;
      failed?: number;
    };
  } | null;
  createdAt: string;
  sourceCount?: number;
};

export function ImportsView() {
  const { showToast } = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [studyDate, setStudyDate] = useState(new Date().toISOString().slice(0, 10));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeJob, setActiveJob] = useState<string | null>(null);
  const [diff, setDiff] = useState<{ jobId: string; revisions: number; sources: number; questions: number } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  async function loadJobs() {
    const response = await fetch("/api/imports");
    if (response.ok) {
      const data = (await response.json()) as { jobs: Job[] };
      setJobs(data.jobs);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadJobs);
    const timer = setInterval(() => void loadJobs(), 4000);
    return () => clearInterval(timer);
  }, []);

  async function startImport() {
    if (!files.length) {
      showToast("请先选择 Markdown 或截图。", "error");
      return;
    }
    setBusy(true);
    try {
      const createResponse = await fetch("/api/imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studyDate })
      });
      const created = (await createResponse.json()) as { id?: string; error?: string };
      if (!createResponse.ok || !created.id) throw new Error(created.error ?? "创建任务失败");
      setActiveJob(created.id);
      for (const file of files) {
        const body = new FormData();
        body.append("file", file);
        const upload = await fetch(`/api/imports/${created.id}/assets`, {
          method: "POST",
          body
        });
        const data = (await upload.json()) as { error?: string };
        if (!upload.ok) throw new Error(data.error ?? `上传 ${file.name} 失败`);
      }
      const submit = await fetch(`/api/imports/${created.id}/submit`, { method: "POST" });
      const submitted = (await submit.json()) as { error?: string };
      if (!submit.ok) throw new Error(submitted.error ?? "提交失败");
      setFiles([]);
      showToast("已提交。可以离开此页，整理会继续在后台进行。");
      await loadJobs();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "导入失败", "error");
    } finally {
      setBusy(false);
    }
  }

  async function undo(job: Job) {
    if (!confirm(`确认撤销 ${job.studyDate} 的导入？如果后续导入仍依赖这些知识点，系统会阻止撤销。`)) {
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/imports/${job.id}/undo`, { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "撤销失败");
      showToast("导入已撤销。");
      await loadJobs();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "撤销失败", "error");
    } finally {
      setBusy(false);
    }
  }

  async function showDiff(job: Job) {
    const response = await fetch(`/api/imports/${job.id}/diff`);
    const data = (await response.json()) as {
      revisions?: unknown[];
      sources?: unknown[];
      questionCount?: number;
      error?: string;
    };
    if (!response.ok) {
      showToast(data.error ?? "无法读取差异", "error");
      return;
    }
    setDiff({
      jobId: job.id,
      revisions: data.revisions?.length ?? 0,
      sources: data.sources?.length ?? 0,
      questions: data.questionCount ?? 0
    });
  }

  return (
    <section className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">导入与整理</h1>
          <p className="page-subtitle">
            导入当天的 Markdown 与 LeetCode 截图。系统会拆解知识点、合并旧内容并更新知识网络。
          </p>
        </div>
      </header>

      <div className="panel">
        <div className="panel-header">
          <strong>新导入</strong>
          <input
            className="input"
            style={{ width: 170 }}
            type="date"
            value={studyDate}
            onChange={(event) => setStudyDate(event.target.value)}
            aria-label="学习日期"
          />
        </div>
        <div className="panel-body stack">
          <button
            type="button"
            className="empty-state"
            style={{ border: "1px dashed var(--border)", borderRadius: 10, background: "#fbfcfa" }}
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              setFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <span className="empty-state-inner">
              <UploadCloud size={30} color="var(--accent)" />
              <h2>拖入或选择当天的笔记</h2>
              <p>支持 .md、PNG、JPEG、WebP；单个任务最多 20 个文件。</p>
            </span>
          </button>
          <input
            ref={fileInput}
            hidden
            multiple
            type="file"
            accept=".md,.markdown,image/png,image/jpeg,image/webp"
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
          {files.length ? (
            <ul className="list">
              {files.map((file) => (
                <li className="list-item" key={`${file.name}-${file.size}`}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {file.type.startsWith("image/") ? <ImageIcon size={16} /> : <FileText size={16} />}
                    {file.name}
                    <span className="muted">{(file.size / 1024).toFixed(1)} KB</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button className="button primary" type="button" disabled={busy} onClick={startImport}>
              <Plus size={16} /> {busy ? "正在上传…" : "开始整理"}
            </button>
          </div>
        </div>
      </div>

      <section className="panel">
        <div className="panel-header">
          <strong>导入记录</strong>
        </div>
        <div className="panel-body">
          {jobs.length === 0 ? (
            <p className="muted">还没有导入记录。</p>
          ) : (
            <ul className="list">
              {jobs.map((job) => (
                <li className="list-item" key={job.id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 12
                    }}
                  >
                    <div style={{ flex: "1 1 420px", minWidth: 0 }}>
                      <strong>{job.studyDate}</strong>{" "}
                      <span className="badge">{statusLabel(job.status)}</span>
                      <div className="muted" style={{ marginTop: 4, lineHeight: 1.7 }}>
                        {jobSummary(job)}
                      </div>
                    </div>
                    {["completed", "failed"].includes(job.status) ? (
                      <div
                        style={{
                          display: "flex",
                          flex: "0 0 auto",
                          gap: 8,
                          flexWrap: "wrap"
                        }}
                      >
                        <button
                          className="button"
                          style={{ whiteSpace: "nowrap" }}
                          type="button"
                          onClick={() => showDiff(job)}
                        >
                          查看差异
                        </button>
                        <Link
                          className="button"
                          style={{ whiteSpace: "nowrap" }}
                          href={`/today?jobId=${job.id}`}
                        >
                          查看整合
                        </Link>
                        {job.status === "completed" ? (
                          <button
                            className="button danger"
                            style={{ whiteSpace: "nowrap" }}
                            type="button"
                            disabled={busy}
                            onClick={() => undo(job)}
                          >
                            撤销
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <span className="muted mono">{job.progress}%</span>
                    )}
                  </div>
                  {job.errorMessage ? <p className="error-text">{job.errorMessage}</p> : null}
                  {diff?.jobId === job.id ? (
                    <p className="muted">
                      本次导入记录了 {diff.revisions} 个知识变更、{diff.sources} 个来源和{" "}
                      {diff.questions} 道题目。
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      {activeJob ? (
        <p className="muted mono">当前任务：{activeJob}</p>
      ) : null}
    </section>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "待提交",
    queued: "排队中",
    parsing: "解析中",
    extracting: "整理中",
    resolving: "建立关联",
    committing: "写入网络",
    completed: "已完成",
    failed: "失败",
    undone: "已撤销"
  };
  return labels[status] ?? status;
}

function jobSummary(job: Job) {
  if (!job.summary) return `${job.sourceCount ?? 0} 个来源`;
  const nodes = [
    ...(job.summary.createdNodes ?? []),
    ...(job.summary.updatedNodes ?? [])
  ].filter(
    (node, index, items) =>
      node.title && items.findIndex((item) => item.id === node.id) === index
  );
  if (!nodes.length) {
    return `本次整理完成，涉及 ${job.sourceCount ?? 0} 个来源`;
  }
  const titles = nodes.slice(0, 3).map((node) => node.title);
  const polished = job.summary.refinement?.notesPolished ?? 0;
  return `本次整理 ${nodes.length} 个知识点：${titles.join("、")}${
    nodes.length > titles.length ? "等" : ""
  }${polished ? ` · AI 完善 ${polished} 篇笔记` : ""}`;
}
