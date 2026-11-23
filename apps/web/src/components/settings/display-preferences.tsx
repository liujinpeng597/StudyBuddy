"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, FolderTree, Network } from "lucide-react";
import { useToast } from "@/components/ui/toast-provider";

type Preferences = {
  directoryDefaultExpanded: boolean;
  mindmapDefaultExpanded: boolean;
};

export function DisplayPreferences() {
  const { showToast } = useToast();
  const [preferences, setPreferences] = useState<Preferences>({
    directoryDefaultExpanded: true,
    mindmapDefaultExpanded: true
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/preferences")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Preferences | null) => {
        if (data) setPreferences(data);
      })
      .catch(() => showToast("无法读取当前设置", "error"));
  }, [showToast]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences)
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "保存失败");
      showToast("设置已保存，下次打开目录或思维导图时生效。");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "保存失败", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <header className="page-header">
        <div>
          <h1 className="page-title">显示与展开</h1>
          <p className="page-subtitle">
            设置知识目录和思维导图打开时的默认状态。跨设备使用同一账户并保存后生效。
          </p>
        </div>
      </header>

      <PreferenceGroup
        icon={<FolderTree size={22} />}
        title="左侧知识目录"
        description="控制网页打开时，Linux、进程管理等目录是否展开。"
        value={preferences.directoryDefaultExpanded}
        onChange={(value) =>
          setPreferences((current) => ({ ...current, directoryDefaultExpanded: value }))
        }
      />

      <PreferenceGroup
        icon={<Network size={22} />}
        title="知识思维导图"
        description="控制进入知识图时，各个领域和主题分支是否展开。"
        value={preferences.mindmapDefaultExpanded}
        onChange={(value) =>
          setPreferences((current) => ({ ...current, mindmapDefaultExpanded: value }))
        }
      />

      <div className="panel panel-body" style={{ display: "flex", justifyContent: "flex-end" }}>
        <button className="button primary" disabled={busy} type="submit">
          {busy ? "保存中…" : "保存设置"}
        </button>
      </div>
    </form>
  );
}

function PreferenceGroup({
  icon,
  title,
  description,
  value,
  onChange
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--accent)" }}>{icon}</span>
          <div>
            <strong>{title}</strong>
            <div className="muted">{description}</div>
          </div>
        </div>
      </div>
      <div className="panel-body" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <PreferenceChoice
          selected={value}
          label="默认展开"
          description="进入页面时显示全部层级"
          onClick={() => onChange(true)}
        />
        <PreferenceChoice
          selected={!value}
          label="默认折叠"
          description="进入页面时只显示一级目录"
          onClick={() => onChange(false)}
        />
      </div>
    </section>
  );
}

function PreferenceChoice({
  selected,
  label,
  description,
  onClick
}: {
  selected: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`list-item ${selected ? "is-selected" : ""}`}
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      style={{
        flex: "1 1 220px",
        borderColor: selected ? "var(--accent)" : "var(--border)",
        background: selected ? "var(--accent-soft)" : "white",
        textAlign: "left",
        cursor: "pointer"
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 650 }}>
        {selected ? <Check size={16} color="var(--accent)" /> : null}
        {label}
      </span>
      <span className="muted">{description}</span>
    </button>
  );
}
