"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Cpu,
  ChevronRight,
  LogOut,
  Menu,
  Network,
  Plus,
  SlidersHorizontal,
  Settings,
  UserRound,
  X
} from "lucide-react";
import { InlineSearch } from "./inline-search";
import type { SessionUser } from "@/lib/server/auth";
import type {
  DisplayPreferences,
  KnowledgeTreeNode,
  KnowledgeTreePayload
} from "@studybuddy/core";

type LatestJob = { id: string; status: string; progress: number } | null;

const tabs = [
  { href: "/today", label: "今日整合" },
  { href: "/graph", label: "知识图" },
  { href: "/review", label: "测试" },
  { href: "/imports", label: "导入记录" }
];

export function WorkbenchShell({
  user,
  initialTree,
  initialPreferences,
  children
}: {
  user: SessionUser;
  initialTree: KnowledgeTreePayload;
  initialPreferences: DisplayPreferences;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [tree, setTree] = useState<KnowledgeTreePayload>(initialTree);
  const [treeState, setTreeState] = useState<"loading" | "ready" | "error">("ready");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [latestJob, setLatestJob] = useState<LatestJob>(null);
  const [displayPreferences, setDisplayPreferences] = useState<DisplayPreferences>(
    initialPreferences
  );
  const topbarActionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/tree", { cache: "no-store" })
      .then(async (response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        if (!response.ok) throw new Error("知识树加载失败");
        return (await response.json()) as KnowledgeTreePayload;
      })
      .then((data) => {
        if (!active || !data) return;
        setTree(data);
        setTreeState("ready");
      })
      .catch(() => {
        if (active) setTreeState("error");
      });
    return () => {
      active = false;
    };
  }, [pathname, router]);

  useEffect(() => {
    if (!settingsOpen && !menuOpen) return;
    const closeMenus = (event: PointerEvent) => {
      if (
        topbarActionsRef.current &&
        !topbarActionsRef.current.contains(event.target as Node)
      ) {
        setSettingsOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeMenus);
    return () => document.removeEventListener("pointerdown", closeMenus);
  }, [settingsOpen, menuOpen]);

  useEffect(() => {
    fetch("/api/preferences")
      .then((response) => {
        if (response.status === 401) {
          router.replace("/login");
          return null;
        }
        return response.ok ? response.json() : null;
      })
      .then((data) => {
        if (data) setDisplayPreferences(data);
      })
      .catch(() => undefined);
  }, [pathname, router]);

  useEffect(() => {
    let active = true;
    const loadJob = async () => {
      try {
        const response = await fetch("/api/imports/latest");
        if (response.ok && active) setLatestJob((await response.json()) as LatestJob);
      } catch {
        if (active) setLatestJob(null);
      }
    };
    void loadJob();
    const timer = setInterval(loadJob, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname !== "/" && !pathname.startsWith("/login")) {
      localStorage.setItem("studybuddy:last-route", pathname);
    }
  }, [pathname]);

  useEffect(() => {
    const focusTreeNode = (event: Event) => {
      const nodeId = (event as CustomEvent<{ nodeId?: string }>).detail?.nodeId;
      if (nodeId) setFocusedNodeId(nodeId);
    };
    window.addEventListener("studybuddy:focus-tree-node", focusTreeNode);
    return () => window.removeEventListener("studybuddy:focus-tree-node", focusTreeNode);
  }, []);

  useEffect(() => {
    if (!focusedNodeId) return;
    const timer = window.setTimeout(() => {
      const target = [...document.querySelectorAll<HTMLElement>("[data-node-id]")].find(
        (element) => element.dataset.nodeId === focusedNodeId
      );
      target?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [focusedNodeId, treeState]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <div
        className={`drawer-backdrop ${drawerOpen ? "visible" : ""}`}
        onClick={() => setDrawerOpen(false)}
      />
      <aside className={`sidebar ${drawerOpen ? "open" : ""}`} aria-label="知识目录">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mark" src="/icons/studybuddy.svg" alt="" />
          <span className="brand-copy">
            <span className="brand-name">知伴</span>
            <span className="brand-tagline">学习搭子</span>
          </span>
          <button
            className="icon-button mobile-menu-button"
            type="button"
            aria-label="关闭目录"
            onClick={() => setDrawerOpen(false)}
            style={{ marginLeft: "auto" }}
          >
            <X size={18} />
          </button>
        </div>
        <div className="sidebar-search">
          <InlineSearch variant="sidebar" />
        </div>
        <nav className="tree-wrap" aria-label="知识树">
          <div className="tree-title">全部知识</div>
          {treeState === "loading" ? (
            <div className="tree-empty">正在加载知识树…</div>
          ) : null}
          {treeState === "error" ? (
            <div className="tree-empty">
              知识树加载失败。
              <div style={{ marginTop: 10 }}>
                <button className="button" type="button" onClick={() => window.location.reload()}>
                  重新加载
                </button>
              </div>
            </div>
          ) : null}
          {treeState === "ready" && tree.tree.length === 0 && tree.uncategorized.length === 0 ? (
            <div className="tree-empty">
              知识树正在等待第一份笔记。
              <div style={{ marginTop: 12 }}>
                <Link className="button" href="/imports?new=1" onClick={() => setDrawerOpen(false)}>
                  导入笔记
                </Link>
              </div>
            </div>
          ) : null}
          <ul className="tree-list">
            {tree.tree.map((module) => (
              <TreeBranch
                key={`${module.id}-${displayPreferences.directoryDefaultExpanded}`}
                node={module}
                pathname={pathname}
                onNavigate={() => setDrawerOpen(false)}
                defaultExpanded={displayPreferences.directoryDefaultExpanded}
                revealNodeId={focusedNodeId}
                focusedNodeId={focusedNodeId}
              />
            ))}
            {tree.uncategorized.map((node) => (
              <li key={node.id}>
                <Link
                  className={`tree-link ${
                    pathname === `/knowledge/${node.id}` || focusedNodeId === node.id
                      ? "active"
                      : ""
                  }`}
                  href={`/knowledge/${node.id}`}
                  data-node-id={node.id}
                  onClick={() => {
                    setDrawerOpen(false);
                  }}
                >
                  {node.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu-button"
              type="button"
              aria-label="打开目录"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={20} />
            </button>
            <InlineSearch variant="topbar" shortcut />
          </div>
          <div className="topbar-right" ref={topbarActionsRef}>
            {latestJob && !["completed", "failed", "undone"].includes(latestJob.status) ? (
              <span className="badge attention">
                <span className="status-dot" style={{ background: "var(--attention)", marginRight: 6 }} />
                {jobLabel(latestJob.status)} {latestJob.progress}%
              </span>
            ) : null}
            <Link className="button primary" href="/imports?new=1">
              <Plus size={16} /> 导入
            </Link>
            <div className="menu-wrap">
              <button
                className="icon-button"
                type="button"
                aria-label="总设置"
                aria-haspopup="menu"
                aria-expanded={settingsOpen}
                title="总设置"
                onClick={() => {
                  setSettingsOpen((open) => !open);
                  setMenuOpen(false);
                }}
              >
                <Settings size={19} />
              </button>
              {settingsOpen ? (
                <div className="menu" role="menu" aria-label="设置">
                  <div className="menu-heading">设置</div>
                  <Link
                    href="/settings/models"
                    role="menuitem"
                    onClick={() => setSettingsOpen(false)}
                  >
                    <Cpu size={15} style={{ marginRight: 8 }} /> 模型设置
                  </Link>
                  <Link
                    href="/settings/display"
                    role="menuitem"
                    onClick={() => setSettingsOpen(false)}
                  >
                    <SlidersHorizontal size={15} style={{ marginRight: 8 }} /> 显示与展开
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="menu-wrap">
              <button
                className="icon-button"
                type="button"
                aria-label="账户菜单"
                aria-expanded={menuOpen}
                onClick={() => {
                  setMenuOpen((open) => !open);
                  setSettingsOpen(false);
                }}
              >
                <UserRound size={19} />
              </button>
              {menuOpen ? (
                <div className="menu" role="menu" aria-label="账户菜单">
                  <div className="menu-heading">
                    {user.email}
                  </div>
                  <Link
                    href="/settings/account"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                  >
                    <BookOpen size={15} style={{ marginRight: 8 }} /> 账户与数据
                  </Link>
                  <button type="button" role="menuitem" onClick={logout}>
                    <LogOut size={15} style={{ marginRight: 8 }} /> 退出登录
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mobile-search-row">
          <InlineSearch variant="mobile" />
        </div>

        <nav className="tabs" aria-label="工作区">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              className={`tab ${pathname === tab.href || (tab.href !== "/today" && pathname.startsWith(`${tab.href}/`)) ? "active" : ""}`}
              href={tab.href}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
        <main id="main-content" className="workspace">
          {children}
        </main>
      </div>
    </div>
  );
}

function TreeBranch({
  node,
  pathname,
  onNavigate,
  defaultExpanded,
  revealNodeId,
  focusedNodeId
}: {
  node: KnowledgeTreeNode;
  pathname: string;
  onNavigate: () => void;
  defaultExpanded: boolean;
  revealNodeId: string | null;
  focusedNodeId: string | null;
}) {
  const [expandedState, setExpandedState] = useState<boolean | null>(null);
  const hasChildren = Boolean(node.children?.length);
  const revealed = Boolean(revealNodeId && treeContainsNode(node, revealNodeId));
  const expanded = expandedState ?? (revealed || defaultExpanded);
  return (
    <li>
      <button
        className={`tree-link tree-toggle ${
          focusedNodeId === node.id ? "active" : ""
        }`}
        type="button"
        data-node-id={node.id}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-controls={hasChildren ? `tree-children-${node.id}` : undefined}
        onClick={() => {
          if (hasChildren) setExpandedState(!expanded);
          if (pathname === "/graph") {
            window.dispatchEvent(
              new CustomEvent("studybuddy:focus-graph-node", {
                detail: { nodeId: node.id }
              })
            );
          }
        }}
      >
        <ChevronRight
          size={13}
          className={`tree-chevron ${expanded ? "expanded" : ""}`}
          aria-hidden="true"
        />
        <span>{node.name}</span>
      </button>
      {hasChildren && expanded ? (
        <ul className="tree-children" id={`tree-children-${node.id}`}>
          {node.children?.map((child) =>
            child.kind !== "knowledge" ? (
              <TreeBranch
                key={`${child.id}-${defaultExpanded}`}
                node={child}
                pathname={pathname}
                onNavigate={onNavigate}
                defaultExpanded={defaultExpanded}
                revealNodeId={revealNodeId}
                focusedNodeId={focusedNodeId}
              />
            ) : (
              <li key={child.id}>
                <Link
                  className={`tree-link ${
                    pathname === `/knowledge/${child.id}` || focusedNodeId === child.id
                      ? "active"
                      : ""
                  }`}
                  href={`/knowledge/${child.id}`}
                  data-node-id={child.id}
                  onClick={() => {
                    onNavigate();
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 6 }}
                >
                  <Network size={12} /> {child.name}
                </Link>
              </li>
            )
          )}
        </ul>
      ) : null}
    </li>
  );
}

function treeContainsNode(node: KnowledgeTreeNode, nodeId: string): boolean {
  if (node.id === nodeId) return true;
  return (node.children ?? []).some((child) => treeContainsNode(child, nodeId));
}

function jobLabel(status: string) {
  const labels: Record<string, string> = {
    queued: "排队中",
    parsing: "解析中",
    extracting: "整理中",
    resolving: "建立关联",
    committing: "写入知识网络",
    completed: "已完成",
    failed: "失败"
  };
  return labels[status] ?? status;
}
