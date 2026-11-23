"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

export function AccountActions() {
  const router = useRouter();
  const { showToast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);

  async function removeAccount() {
    if (!confirm("这会永久删除账户、知识网络、题目和来源文件。继续吗？")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "删除失败");
      showToast("账户已删除。");
      router.replace("/login");
      router.refresh();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "删除失败", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">账户与数据</h1>
          <p className="page-subtitle">导出完整学习资料，或在不再使用时永久删除全部数据。</p>
        </div>
      </header>
      <section className="panel">
        <div className="panel-header">
          <strong>导出数据</strong>
        </div>
        <div className="panel-body stack">
          <p className="muted">导出包含知识节点、关联、题目、答题记录、LeetCode 档案和原始来源文件。</p>
          <a className="button" href="/api/account/export">
            <Download size={16} /> 下载 ZIP
          </a>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <strong style={{ color: "var(--danger)" }}>删除全部数据</strong>
        </div>
        <div className="panel-body stack">
          <p className="muted">删除后无法恢复。请输入当前密码，并输入 `删除我的全部数据`。</p>
          <div className="field">
            <label htmlFor="deletePassword">当前密码</label>
            <input
              id="deletePassword"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="deleteConfirmation">确认文字</label>
            <input
              id="deleteConfirmation"
              className="input"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </div>
          <button
            className="button danger"
            type="button"
            disabled={busy || confirmation !== "删除我的全部数据" || !password}
            onClick={removeAccount}
          >
            <Trash2 size={16} /> {busy ? "删除中…" : "永久删除账户"}
          </button>
        </div>
      </section>
    </section>
  );
}
