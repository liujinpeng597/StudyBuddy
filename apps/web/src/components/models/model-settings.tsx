"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, FlaskConical, Pencil, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

type Role =
  | "image_extraction"
  | "normalization"
  | "merge_judgement"
  | "embedding"
  | "question_generation"
  | "answer_evaluation";

type Profile = {
  id: string;
  displayName: string;
  baseUrl: string;
  modelId: string;
  apiKeyHint: string;
  capabilities: string[];
  roles: Role[];
  status: string;
  lastTestedAt: string | null;
};

const roleLabels: Record<Role, string> = {
  image_extraction: "截图提取",
  normalization: "笔记整理",
  merge_judgement: "知识合并",
  embedding: "语义向量",
  question_generation: "出题",
  answer_evaluation: "问答题评分"
};

const defaultRoles: Role[] = [
  "normalization",
  "merge_judgement",
  "question_generation",
  "answer_evaluation"
];

export function ModelSettings() {
  const { showToast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("DeepSeek V4.1 Flash");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelId, setModelId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [roles, setRoles] = useState<Role[]>(defaultRoles);

  async function load() {
    const response = await fetch("/api/models");
    if (response.ok) {
      const data = (await response.json()) as { profiles: Profile[] };
      setProfiles(data.profiles);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(editingId ? `/api/models/${editingId}` : "/api/models", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          baseUrl,
          modelId,
          ...(apiKey ? { apiKey } : {}),
          capabilities: ["text", "json", "vision"],
          roles
        })
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "保存失败");
      setEditing(false);
      setEditingId(null);
      setApiKey("");
      await load();
      showToast("模型配置已保存。");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败", "error");
    } finally {
      setBusy(false);
    }
  }

  async function test(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/models/${id}/test`, { method: "POST" });
      const data = (await response.json()) as {
        error?: string;
        status?: string;
        capabilities?: string[];
        errors?: string[];
      };
      if (!response.ok) throw new Error(data.error ?? "测试失败");
      showToast(
        `测试结果：${data.status}；能力：${data.capabilities?.join(", ") || "无"}${
          data.errors?.length ? `；${data.errors.join("；")}` : ""
        }`,
        data.status === "available" ? "success" : "error"
      );
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "测试失败", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("确认删除这个模型配置？")) return;
    try {
      const response = await fetch(`/api/models/${id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "删除失败");
      await load();
      showToast("模型配置已删除。");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "删除失败", "error");
    }
  }

  function startEdit(profile: Profile) {
    setEditingId(profile.id);
    setDisplayName(profile.displayName);
    setBaseUrl(profile.baseUrl);
    setModelId(profile.modelId);
    setApiKey("");
    setRoles(profile.roles);
    setEditing(true);
  }

  return (
    <section className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">模型设置</h1>
          <p className="page-subtitle">
            自行接入 OpenAI 兼容接口。默认名称为 DeepSeek V4.1 Flash，实际 Base URL 和 Model ID
            以你的服务商为准。
          </p>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() => {
            setEditingId(null);
            setDisplayName("DeepSeek V4.1 Flash");
            setBaseUrl("");
            setModelId("");
            setApiKey("");
            setRoles(defaultRoles);
            setEditing(true);
          }}
        >
          <Plus size={16} /> 接入模型
        </button>
      </header>

      {editing ? (
        <form className="panel" onSubmit={create}>
          <div className="panel-header">
            <strong>新模型配置</strong>
            <button
              className="button ghost"
              type="button"
              onClick={() => {
                setEditing(false);
                setEditingId(null);
              }}
            >
              取消
            </button>
          </div>
          <div className="panel-body stack">
            <div className="grid-two">
              <div className="field">
                <label htmlFor="displayName">显示名称</label>
                <input
                  id="displayName"
                  className="input"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="modelId">API Model ID</label>
                <input
                  id="modelId"
                  className="input"
                  placeholder="官方 DeepSeek 可先尝试 deepseek-flash"
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="baseUrl">Base URL</label>
              <input
                id="baseUrl"
                className="input"
                type="url"
                placeholder="https://api.example.com/v1"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="apiKey">API Key</label>
              <input
                id="apiKey"
                className="input"
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                required={!editingId}
              />
              <span className="muted">
                {editingId
                  ? "留空表示继续使用原密钥；填写新值会替换旧密钥。"
                  : "密钥加密保存，只显示尾号。测试时笔记和截图会发送到你配置的服务商。"}
              </span>
            </div>
            <fieldset className="field" style={{ border: 0, padding: 0 }}>
              <legend style={{ fontWeight: 600, marginBottom: 8 }}>用途</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {(Object.keys(roleLabels) as Role[]).map((role) => (
                  <label key={role} className="badge" style={{ padding: "7px 10px" }}>
                    <input
                      type="checkbox"
                      checked={roles.includes(role)}
                      onChange={(event) =>
                        setRoles((current) =>
                          event.target.checked
                            ? [...current, role]
                            : current.filter((item) => item !== role)
                        )
                      }
                    />
                    {roleLabels[role]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="dialog-footer">
            <span className="muted">测试通过后才会绑定对应任务。</span>
            <button className="button primary" disabled={busy || roles.length === 0}>
              {busy ? "保存中…" : "保存配置"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="stack">
        {profiles.length === 0 ? (
          <div className="panel empty-state">
            <div className="empty-state-inner">
              <FlaskConical size={30} color="var(--accent)" />
              <h2>还没有接入模型</h2>
              <p>添加模型后，测试其文本、JSON、图片和向量能力，再绑定到对应任务。</p>
            </div>
          </div>
        ) : (
          profiles.map((profile) => (
            <article key={profile.id} className="panel">
              <div className="panel-header">
                <div>
                  <strong>{profile.displayName}</strong>
                  <div className="muted mono">
                    {profile.modelId} · {profile.apiKeyHint}
                  </div>
                </div>
                <span className={`badge ${profile.status === "available" ? "accent" : "attention"}`}>
                  {statusLabel(profile.status)}
                </span>
              </div>
              <div className="panel-body stack">
                <div>
                  <span className="muted">能力：</span>{" "}
                  {profile.capabilities.length ? profile.capabilities.join("、") : "尚未测试"}
                </div>
                <div>
                  <span className="muted">任务：</span>{" "}
                  {profile.roles.map((role) => roleLabels[role]).join("、")}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    className="button"
                    type="button"
                    disabled={busy}
                    onClick={() => test(profile.id)}
                  >
                    <CheckCircle2 size={16} /> 测试连接
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={busy}
                    onClick={() => startEdit(profile)}
                  >
                    <Pencil size={16} /> 编辑
                  </button>
                  <button
                    className="button danger"
                    type="button"
                    disabled={busy}
                    onClick={() => remove(profile.id)}
                  >
                    <Trash2 size={16} /> 删除
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    untested: "未测试",
    available: "可用",
    partial: "部分可用",
    failed: "测试失败",
    disabled: "已停用"
  };
  return labels[status] ?? status;
}
