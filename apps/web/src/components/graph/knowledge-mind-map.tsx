"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  ChevronRight,
  Expand,
  List,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Minus,
  Network,
  Plus,
  RotateCcw,
  Scan,
  Sparkles,
  WandSparkles,
  Waypoints,
  X
} from "lucide-react";
import {
  graphBounds,
  measureGraphNode,
  resolveGraphCollisions,
  type PositionedNode,
  type SavedPosition
} from "@/lib/graph/layout";
import { useToast } from "@/components/ui/toast-provider";

type TreeNode = {
  id: string;
  name: string;
  kind: "module" | "topic" | "knowledge";
  changed?: boolean;
  needsReview?: boolean;
  children?: TreeNode[];
};

type TreeResponse = {
  tree: TreeNode[];
  uncategorized: Array<{
    id: string;
    name: string;
    changed?: boolean;
    needsReview?: boolean;
  }>;
};

type KnowledgeGraphNode = {
  id: string;
  title: string;
  summary: string;
  module: string;
  x: number;
  y: number;
  changed: boolean;
  needsReview: boolean;
};

type GraphEdge = {
  id?: string;
  source: string;
  target: string;
  type: string;
  confidence?: number;
  origin?: string;
  needsReview?: boolean;
};

type GraphResponse = {
  nodes: KnowledgeGraphNode[];
  edges: GraphEdge[];
};

type GraphNode = PositionedNode & {
  title: string;
  kind: "root" | "module" | "knowledge";
  parentId: string | null;
  depth: number;
  count: number;
  relationCount: number;
  summary: string;
  path: string;
  changed?: boolean;
  needsReview?: boolean;
  tone: number;
  difficulty?: number;
};

type SemanticSuggestion = {
  id: string;
  title: string;
  summary: string;
  path: string;
  similarity: number;
};

type Viewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type SavedPositions = Record<string, SavedPosition>;
type Difficulties = Record<string, number>;

const POSITION_KEY = "studybuddy:graph-positions:v3";
const DIFFICULTY_KEY = "studybuddy:graph-difficulties:v1";

export function KnowledgeMindMap() {
  const router = useRouter();
  const { showToast } = useToast();
  const viewportRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const boardObserverRef = useRef<ResizeObserver | null>(null);
  const dragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    viewX: number;
    viewY: number;
  } | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const collapsedInitializedRef = useRef(false);
  const queryFocusDoneRef = useRef(false);
  const positionsRef = useRef<SavedPositions>({});
  const nodesRef = useRef<GraphNode[]>([]);

  const [tree, setTree] = useState<TreeResponse>({ tree: [], uncategorized: [] });
  const [graph, setGraph] = useState<GraphResponse>({ nodes: [], edges: [] });
  const [listMode, setListMode] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [rootCollapsed, setRootCollapsed] = useState(false);
  const [savedPositions, setSavedPositions] = useState<SavedPositions>({});
  const [positions, setPositions] = useState<SavedPositions>({});
  const [difficulties, setDifficulties] = useState<Difficulties>({});
  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    width: 1500,
    height: 920
  });
  const [boardSize, setBoardSize] = useState({ width: 1050, height: 620 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [lastHoveredKnowledgeId, setLastHoveredKnowledgeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [connectionPoint, setConnectionPoint] = useState<SavedPosition | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [semanticSourceId, setSemanticSourceId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SemanticSuggestion[]>([]);
  const [immersive, setImmersive] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const setViewportElement = useCallback((element: HTMLDivElement | null) => {
    boardObserverRef.current?.disconnect();
    viewportRef.current = element;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setBoardSize({ width: rect.width, height: rect.height });
    });
    observer.observe(element);
    boardObserverRef.current = observer;
  }, []);

  useEffect(
    () => () => {
      boardObserverRef.current?.disconnect();
    },
    []
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const storedPositions = localStorage.getItem(POSITION_KEY);
        const storedDifficulties = localStorage.getItem(DIFFICULTY_KEY);
        if (storedPositions) {
          setSavedPositions(JSON.parse(storedPositions) as SavedPositions);
        }
        if (storedDifficulties) {
          setDifficulties(JSON.parse(storedDifficulties) as Difficulties);
        }
      } catch {
        localStorage.removeItem(POSITION_KEY);
        localStorage.removeItem(DIFFICULTY_KEY);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function loadData() {
    const [treeResponse, graphResponse, preferencesResponse] = await Promise.all([
      fetch("/api/tree", { cache: "no-store" }),
      fetch("/api/graph", { cache: "no-store" }),
      fetch("/api/preferences", { cache: "no-store" })
    ]);
    if (!treeResponse.ok) throw new Error("知识树加载失败");
    if (!graphResponse.ok) throw new Error("知识关联加载失败");
    const treeData = (await treeResponse.json()) as TreeResponse;
    const graphData = (await graphResponse.json()) as GraphResponse;
    setTree(treeData);
    setGraph(graphData);
    if (preferencesResponse.ok) {
      const preferences = (await preferencesResponse.json()) as {
        mindmapDefaultExpanded?: boolean;
      };
      if (!collapsedInitializedRef.current) {
        setCollapsed(
          preferences.mindmapDefaultExpanded === false
            ? new Set(allModuleIds(treeData.tree))
            : new Set()
        );
        collapsedInitializedRef.current = true;
      }
    }
  }

  useEffect(() => {
    void Promise.resolve()
      .then(loadData)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : "知识网络加载失败")
      );
  }, []);

  useEffect(() => {
    document.body.classList.toggle("graph-immersive", immersive);
    return () => document.body.classList.remove("graph-immersive");
  }, [immersive]);

  useEffect(() => {
    const closeImmersive = (event: KeyboardEvent) => {
      if (event.key === "Escape") setImmersive(false);
    };
    window.addEventListener("keydown", closeImmersive);
    return () => window.removeEventListener("keydown", closeImmersive);
  }, []);

  const relationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const edge of graph.edges) {
      counts.set(edge.source, (counts.get(edge.source) ?? 0) + 1);
      counts.set(edge.target, (counts.get(edge.target) ?? 0) + 1);
    }
    return counts;
  }, [graph.edges]);

  const baseNodes = useMemo(
    () => buildGraphNodes(tree, graph.nodes, collapsed, relationCounts, rootCollapsed),
    [tree, graph.nodes, collapsed, relationCounts, rootCollapsed]
  );
  const effectivelyCollapsed = useMemo(() => {
    const next = new Set(collapsed);
    if (rootCollapsed) next.add("graph-root");
    return next;
  }, [collapsed, rootCollapsed]);
  const baseViewKey = useMemo(
    () =>
      baseNodes
        .map((node) => `${node.id}:${node.x}:${node.y}:${node.width}:${node.height}`)
        .join("|"),
    [baseNodes]
  );

  const displayNodes = useMemo<GraphNode[]>(
    () =>
      resolveGraphCollisions(
        baseNodes.map((node) => ({
          ...node,
          ...(savedPositions[node.id] ?? {}),
          ...(positions[node.id] ?? {}),
          difficulty: difficulties[node.id]
        }))
      ),
    [baseNodes, savedPositions, positions, difficulties]
  );

  useEffect(() => {
    nodesRef.current = displayNodes;
    positionsRef.current = Object.fromEntries(
      displayNodes.map((node) => [node.id, { x: node.x, y: node.y }])
    );
  }, [displayNodes]);

  const fitNodes = useCallback((nodes: GraphNode[]) => {
    if (!nodes.length) return;
    const bounds = graphBounds(nodes);
    const rect = viewportRef.current?.getBoundingClientRect();
    const aspect = rect && rect.height > 0 ? rect.width / rect.height : 16 / 9;
    const contentWidth = Math.max(600, bounds.maxX - bounds.minX + 180);
    const contentHeight = Math.max(420, bounds.maxY - bounds.minY + 180);
    let width = contentWidth;
    let height = contentHeight;
    if (width / height > aspect) height = width / aspect;
    else width = height * aspect;
    setViewport({
      x: (bounds.minX + bounds.maxX) / 2 - width / 2,
      y: (bounds.minY + bounds.maxY) / 2 - height / 2,
      width,
      height
    });
  }, []);

  useEffect(() => {
    if (queryFocusDoneRef.current || !displayNodes.length) return;
    const timer = window.setTimeout(() => {
      const focus = new URLSearchParams(window.location.search).get("focus")?.trim();
      if (!focus) {
        queryFocusDoneRef.current = true;
        return;
      }
      const normalized = focus.toLocaleLowerCase("zh-CN");
      const target =
        displayNodes.find(
          (node) =>
            node.kind === "knowledge" &&
            node.title.toLocaleLowerCase("zh-CN") === normalized
        ) ??
        displayNodes.find(
          (node) =>
            node.kind === "knowledge" &&
            (node.title.toLocaleLowerCase("zh-CN").includes(normalized) ||
              normalized.includes(node.title.toLocaleLowerCase("zh-CN")))
        );
      queryFocusDoneRef.current = true;
      if (!target) return;
      setSelectedNodeId(target.id);
      setLastHoveredKnowledgeId(target.id);
      fitNodes([target]);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [displayNodes, fitNodes]);

  useEffect(() => {
    if (!baseNodes.length) return;
    const frame = requestAnimationFrame(() => {
      fitNodes(nodesRef.current);
    });
    return () => cancelAnimationFrame(frame);
  }, [baseViewKey, baseNodes.length, fitNodes]);

  useEffect(() => {
    const focusGraphNode = (event: Event) => {
      const nodeId = (event as CustomEvent<{ nodeId?: string }>).detail?.nodeId;
      if (!nodeId) return;
      const node = nodesRef.current.find((item) => item.id === nodeId);
      if (!node) return;
      setSelectedNodeId(node.id);
      if (node.kind === "knowledge") setLastHoveredKnowledgeId(node.id);
      fitNodes([node]);
    };
    window.addEventListener("studybuddy:focus-graph-node", focusGraphNode);
    return () => window.removeEventListener("studybuddy:focus-graph-node", focusGraphNode);
  }, [fitNodes]);

  const modules = useMemo(
    () => tree.tree.filter((module) => countKnowledge(module) > 0),
    [tree]
  );
  const hoveredNode = displayNodes.find((node) => node.id === hoveredId) ?? null;
  const selectedKnowledgeId =
    displayNodes.find((node) => node.id === selectedNodeId && node.kind === "knowledge")?.id ??
    lastHoveredKnowledgeId;
  const visibleIds = new Set(displayNodes.map((node) => node.id));
  const relationEdges = graph.edges.filter(
    (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)
  );
  const semanticEdges =
    semanticSourceId && visibleIds.has(semanticSourceId)
      ? suggestions.filter((suggestion) => visibleIds.has(suggestion.id))
      : [];
  const hoveredPopoverPosition = hoveredNode
    ? popoverPosition(hoveredNode, viewport, boardSize)
    : null;

  async function regroup() {
    setBusy("regroup");
    try {
      const response = await fetch("/api/knowledge/regroup", { method: "POST" });
      const data = (await response.json()) as {
        changed?: number;
        unclassified?: number;
        cached?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "AI 重组失败");
      collapsedInitializedRef.current = false;
      await loadData();
      showToast(
        data.cached
          ? "分类内容没有变化，继续使用上次的稳定分组与学习顺序。"
          : `AI 已按由浅入深重新归类 ${data.changed ?? 0} 个知识点${
              data.unclassified ? `，${data.unclassified} 个保留原分组` : ""
            }。`
      );
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "AI 重组失败", "error");
    } finally {
      setBusy("");
    }
  }

  async function arrangeWithAi() {
    setBusy("layout");
    try {
      const response = await fetch("/api/graph/ai-layout", { method: "POST" });
      const data = (await response.json()) as {
        positions?: SavedPositions;
        difficulties?: Difficulties;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "AI 排版失败");
      const reflowed = reflowParents(baseNodes, data.positions ?? {}, {
        ...positionsRef.current,
        ...(data.positions ?? {})
      });
      const resolved = resolveGraphCollisions(reflowed);
      const nextPositions = Object.fromEntries(
        resolved.map((node) => [node.id, { x: node.x, y: node.y }])
      );
      const nextDifficulties = data.difficulties ?? {};
      setPositions({});
      setSavedPositions(nextPositions);
      setDifficulties(nextDifficulties);
      localStorage.setItem(POSITION_KEY, JSON.stringify(nextPositions));
      localStorage.setItem(DIFFICULTY_KEY, JSON.stringify(nextDifficulties));
      showToast("AI 已按基础、进阶、高级重新分层，并完成防重叠排版。");
      requestAnimationFrame(() =>
        fitNodes(reflowed.map((node) => ({ ...node, ...nextPositions[node.id] })) as GraphNode[])
      );
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "AI 排版失败", "error");
    } finally {
      setBusy("");
    }
  }

  async function findSemanticRelations() {
    if (!selectedKnowledgeId) {
      showToast("先把鼠标悬停到一个具体知识点，再点击“AI 语义关联”。", "info");
      return;
    }
    setBusy("suggestions");
    try {
      const response = await fetch(
        `/api/graph/suggestions?nodeId=${encodeURIComponent(selectedKnowledgeId)}`
      );
      const data = (await response.json()) as {
        suggestions?: SemanticSuggestion[];
        reason?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "语义关联分析失败");
      setSemanticSourceId(selectedKnowledgeId);
      setSuggestions(data.suggestions ?? []);
      showToast(
        data.reason ??
          (data.suggestions?.length
            ? `找到 ${data.suggestions.length} 个跨分支语义关联，虚线为待确认建议。`
            : "当前没有找到足够强的跨分支语义关联。")
      );
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "语义关联分析失败", "error");
    } finally {
      setBusy("");
    }
  }

  async function createRelation(source: string, target: string) {
    setBusy("relation");
    try {
      const response = await fetch("/api/graph/relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, target })
      });
      const data = (await response.json()) as { edge?: GraphEdge; error?: string };
      if (!response.ok || !data.edge) throw new Error(data.error ?? "连线保存失败");
      setGraph((current) => {
        const edges = current.edges.filter((edge) => edge.id !== data.edge?.id);
        return { ...current, edges: [...edges, data.edge!] };
      });
      setSuggestions((current) => current.filter((item) => item.id !== target));
      showToast("已保存你手动建立的知识关联。");
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : "连线保存失败", "error");
    } finally {
      setBusy("");
    }
  }

  function activateNode(node: GraphNode) {
    setSelectedNodeId(node.id);
    if (node.kind === "knowledge") {
      setLastHoveredKnowledgeId(node.id);
      window.dispatchEvent(
        new CustomEvent("studybuddy:focus-tree-node", { detail: { nodeId: node.id } })
      );
      router.push(`/knowledge/${node.id}`);
      return;
    }
    if (node.kind === "module") {
      setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(node.id)) next.delete(node.id);
        else next.add(node.id);
        return next;
      });
      return;
    }
    setRootCollapsed((current) => !current);
  }

  function beginNodeInteraction(
    event: ReactPointerEvent<HTMLDivElement>,
    node: GraphNode
  ) {
    event.preventDefault();
    event.stopPropagation();
    setHoveredId(null);
    setSelectedNodeId(node.id);
    if (node.kind === "knowledge") setLastHoveredKnowledgeId(node.id);
    svgRef.current?.setPointerCapture(event.pointerId);
    if (connectMode) {
      if (node.kind !== "knowledge") return;
      const point = screenToWorld(event.clientX, event.clientY);
      setConnectionSourceId(node.id);
      setConnectionPoint(point);
      return;
    }
    const position = positionsRef.current[node.id] ?? node;
    dragRef.current = {
      id: node.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false
    };
  }

  function beginPan(event: ReactPointerEvent<SVGSVGElement>) {
    if ((event.target as Element).closest("[data-graph-node-id]")) return;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      viewX: viewport.x,
      viewY: viewport.y
    };
    svgRef.current?.setPointerCapture(event.pointerId);
    setHoveredId(null);
  }

  function movePointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current) {
      const drag = dragRef.current;
      const delta = screenDelta(event.clientX - drag.startX, event.clientY - drag.startY);
      if (Math.abs(delta.x) + Math.abs(delta.y) > 3) drag.moved = true;
      setPositions((current) => ({
        ...current,
        [drag.id]: {
          x: drag.originX + delta.x,
          y: drag.originY + delta.y
        }
      }));
      return;
    }
    if (connectionSourceId) {
      setConnectionPoint(screenToWorld(event.clientX, event.clientY));
      return;
    }
    if (panRef.current) {
      const pan = panRef.current;
      const delta = screenDelta(event.clientX - pan.startX, event.clientY - pan.startY);
      setViewport((current) => ({
        ...current,
        x: pan.viewX - delta.x,
        y: pan.viewY - delta.y
      }));
    }
  }

  function endPointer(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current) {
      const drag = dragRef.current;
      dragRef.current = null;
      if (drag.moved) {
        const moving = displayNodes.map((node) => ({
          ...node,
          ...(positionsRef.current[node.id] ?? {})
        }));
        const resolved = resolveGraphCollisions(moving);
        const nextPositions = Object.fromEntries(
          resolved.map((node) => [node.id, { x: node.x, y: node.y }])
        );
        setPositions({});
        setSavedPositions((current) => {
          const next = { ...current, ...nextPositions };
          localStorage.setItem(POSITION_KEY, JSON.stringify(next));
          return next;
        });
      } else {
        const node = displayNodes.find((item) => item.id === drag.id);
        if (node) activateNode(node);
      }
    }
    if (connectionSourceId) {
      const point = screenToWorld(event.clientX, event.clientY);
      const target = nearestKnowledgeNode(point, displayNodes, connectionSourceId);
      setConnectionSourceId(null);
      setConnectionPoint(null);
      if (target) void createRelation(connectionSourceId, target.id);
    }
    panRef.current = null;
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId);
    }
  }

  function screenToWorld(clientX: number, clientY: number): SavedPosition {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: viewport.x, y: viewport.y };
    return {
      x: viewport.x + ((clientX - rect.left) / rect.width) * viewport.width,
      y: viewport.y + ((clientY - rect.top) / rect.height) * viewport.height
    };
  }

  function screenDelta(deltaX: number, deltaY: number): SavedPosition {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return { x: deltaX, y: deltaY };
    return {
      x: (deltaX / rect.width) * viewport.width,
      y: (deltaY / rect.height) * viewport.height
    };
  }

  function zoomBy(factor: number) {
    setViewport((current) => {
      const width = Math.max(360, Math.min(5000, current.width * factor));
      const height = current.height * (width / current.width);
      return {
        x: current.x + (current.width - width) / 2,
        y: current.y + (current.height - height) / 2,
        width,
        height
      };
    });
  }

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || listMode) return;
    const zoomWithWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect?.width || !rect.height) return;
      setViewport((current) => {
        const pointerX = current.x + ((event.clientX - rect.left) / rect.width) * current.width;
        const pointerY = current.y + ((event.clientY - rect.top) / rect.height) * current.height;
        const factor = Math.exp(event.deltaY * 0.0012);
        const width = Math.max(360, Math.min(5000, current.width * factor));
        const height = current.height * (width / current.width);
        return {
          x: pointerX - ((pointerX - current.x) / current.width) * width,
          y: pointerY - ((pointerY - current.y) / current.height) * height,
          width,
          height
        };
      });
    };
    svg.addEventListener("wheel", zoomWithWheel, { passive: false });
    return () => svg.removeEventListener("wheel", zoomWithWheel);
  }, [baseNodes.length, listMode]);

  function scheduleHoverClear() {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => setHoveredId(null), 140);
  }

  const zoomPercent = Math.max(20, Math.round((1500 / viewport.width) * 100));

  if (error) return <p className="error-text">{error}</p>;

  return (
    <section className="stack">
      <header className="page-header">
        <div>
          <h1 className="page-title">层级知识网络</h1>
          <p className="page-subtitle">
            按知识层级稳定分组，再把你自己的跨分支关联织成网络。拖拽即可整理，位置会留在当前浏览器。
          </p>
        </div>
        <div className="graph-header-actions">
          <button className="button" type="button" disabled={busy === "regroup"} onClick={regroup}>
            {busy === "regroup" ? <LoaderCircle size={16} /> : <Sparkles size={16} />}
            {busy === "regroup" ? "AI 重组中…" : "AI 重组分支"}
          </button>
          <button
            className="button"
            type="button"
            onClick={() => setListMode((value) => !value)}
          >
            {listMode ? <Network size={16} /> : <List size={16} />}
            {listMode ? "图谱视图" : "列表视图"}
          </button>
        </div>
      </header>

      {modules.length === 0 && tree.uncategorized.length === 0 ? (
        <div className="panel empty-state">
          <div className="empty-state-inner">
            <Network size={30} color="var(--accent)" />
            <h2>知识网络还是空的</h2>
            <p>导入第一份笔记后，AI 会自动建立领域、主题和子主题分支。</p>
            <Link className="button primary" href="/imports?new=1">
              导入笔记
            </Link>
          </div>
        </div>
      ) : listMode ? (
        <MindMapList modules={modules} uncategorized={tree.uncategorized} />
      ) : (
        <div className={`graph-workspace ${immersive ? "is-immersive" : ""}`}>
          <div className="mindmap-toolbar graph-toolbar" aria-label="知识网络工具">
            <div className="graph-tool-group">
              <button
                className="icon-button"
                type="button"
                aria-label="缩小导图"
                onClick={() => zoomBy(1.18)}
              >
                <Minus size={16} />
              </button>
              <span className="mono graph-zoom">{zoomPercent}%</span>
              <button
                className="icon-button"
                type="button"
                aria-label="放大导图"
                onClick={() => zoomBy(0.84)}
              >
                <Plus size={16} />
              </button>
              <button
                className="button compact"
                type="button"
                onClick={() => fitNodes(displayNodes)}
              >
                <Scan size={15} /> 适应画布
              </button>
              <button
                className="icon-button"
                type="button"
                aria-label="重置导图缩放"
                onClick={() => fitNodes(displayNodes)}
              >
                <RotateCcw size={15} />
              </button>
            </div>
            <span className="graph-tool-divider" />
            <div className="graph-tool-group">
              <button
                className={`button compact ${connectMode ? "is-active" : ""}`}
                type="button"
                aria-pressed={connectMode}
                onClick={() => {
                  setConnectMode((current) => !current);
                  setConnectionSourceId(null);
                }}
              >
                <Waypoints size={15} /> 连线模式
              </button>
              <button
                className="button compact"
                type="button"
                disabled={!selectedKnowledgeId || busy === "suggestions"}
                onClick={findSemanticRelations}
              >
                {busy === "suggestions" ? (
                  <LoaderCircle size={15} />
                ) : (
                  <Sparkles size={15} />
                )}
                AI 语义关联
              </button>
              <button
                className="button compact"
                type="button"
                disabled={busy === "layout"}
                onClick={arrangeWithAi}
              >
                {busy === "layout" ? <LoaderCircle size={15} /> : <WandSparkles size={15} />}
                AI 整理
              </button>
            </div>
            <button
              className="icon-button graph-fullscreen"
              type="button"
              aria-label={immersive ? "退出沉浸模式" : "进入沉浸模式"}
              onClick={() => setImmersive((current) => !current)}
            >
              {immersive ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
          </div>

          <div className="graph-mode-hint">
            {connectMode ? (
              <span>
                <Waypoints size={14} /> 从一个知识点拖到另一个知识点，松开即可保存关联。
              </span>
            ) : (
              <span>
                <Expand size={14} /> 滚轮缩放，拖动画布平移；悬停看摘要，单击父级折叠，单击知识点进入详情。
              </span>
            )}
          </div>

          <div
            className="mindmap-viewport graph-viewport panel"
            ref={setViewportElement}
            aria-label="知识思维导图"
          >
            <svg
              ref={svgRef}
              className={`knowledge-network-svg ${connectMode ? "is-connecting" : ""}`}
              viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
              role="application"
              aria-label="可拖拽的知识网络画布"
              onPointerDown={beginPan}
              onPointerMove={movePointer}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
            >
              <defs>
                <marker
                  id="network-arrow"
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" className="graph-arrow" />
                </marker>
              </defs>
              <g className="graph-edge-layer" aria-hidden="true">
                {displayNodes.map((node) => {
                  if (!node.parentId) return null;
                  const parent = displayNodes.find((item) => item.id === node.parentId);
                  return parent ? (
                    <path
                      key={`hierarchy-${node.id}`}
                      className="graph-edge graph-edge-hierarchy"
                      d={edgePath(parent, node)}
                    />
                  ) : null;
                })}
                {relationEdges.map((edge) => {
                  const source = displayNodes.find((node) => node.id === edge.source);
                  const target = displayNodes.find((node) => node.id === edge.target);
                  return source && target ? (
                    <path
                      key={`relation-${edge.id ?? `${edge.source}-${edge.target}`}`}
                      className={`graph-edge graph-edge-relation ${
                        edge.origin === "manual" ? "is-manual" : ""
                      }`}
                      d={crossEdgePath(source, target)}
                      markerEnd="url(#network-arrow)"
                    />
                  ) : null;
                })}
                {semanticEdges.map((suggestion) => {
                  const source = displayNodes.find((node) => node.id === semanticSourceId);
                  const target = displayNodes.find((node) => node.id === suggestion.id);
                  return source && target ? (
                    <path
                      key={`semantic-${suggestion.id}`}
                      className="graph-edge graph-edge-semantic"
                      d={crossEdgePath(source, target)}
                    />
                  ) : null;
                })}
                {connectionSourceId && connectionPoint ? (() => {
                  const source = displayNodes.find((node) => node.id === connectionSourceId);
                  return source ? (
                    <path
                      className="graph-edge graph-edge-preview"
                      d={`M ${source.x + source.width} ${source.y + source.height / 2} L ${connectionPoint.x} ${connectionPoint.y}`}
                    />
                  ) : null;
                })() : null}
              </g>

              <g className="graph-node-layer">
                {displayNodes.map((node) => (
                  <foreignObject
                    key={node.id}
                    x={node.x}
                    y={node.y}
                    width={node.width}
                    height={node.height}
                  >
                    <div
                      className={`graph-node graph-node-${node.kind} tone-${node.tone} ${
                        effectivelyCollapsed.has(node.id) ? "is-collapsed" : ""
                      } ${selectedNodeId === node.id ? "is-selected" : ""} ${
                        node.kind === "module" ? "mindmap-module-node" : ""
                      }`}
                      data-graph-node-id={node.id}
                      role="button"
                      tabIndex={0}
                      aria-expanded={
                        node.kind === "knowledge"
                          ? undefined
                          : !effectivelyCollapsed.has(node.id)
                      }
                      aria-label={`${node.title}，${node.kind === "knowledge" ? `${node.relationCount} 条关联` : `${node.count} 个知识点`}`}
                      onPointerDown={(event) => beginNodeInteraction(event, node)}
                      onPointerEnter={() => {
                        if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
                        setHoveredId(node.id);
                        if (node.kind === "knowledge") setLastHoveredKnowledgeId(node.id);
                      }}
                      onPointerLeave={scheduleHoverClear}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          activateNode(node);
                        }
                      }}
                    >
                      <span className="graph-node-copy">
                        <span className="graph-node-title">{node.title}</span>
                        {node.kind !== "root" ? (
                          <span className="graph-node-path">
                            {node.kind === "knowledge"
                              ? node.relationCount
                                ? `${node.relationCount} 条关联`
                                : "暂无关联"
                              : node.kind === "module"
                                ? "点击展开或折叠"
                                : node.path}
                          </span>
                        ) : (
                          <span className="graph-node-path">
                            {rootCollapsed ? "点击展开知识网络" : "点击收起全部"}
                          </span>
                        )}
                      </span>
                      <span className="graph-node-tail">
                        {node.difficulty ? (
                          <span
                            className={`difficulty-mark difficulty-${node.difficulty}`}
                            title={difficultyLabel(node.difficulty)}
                          />
                        ) : null}
                        {node.kind !== "knowledge" ? (
                          <span className="graph-count">{node.count}</span>
                        ) : null}
                        {node.kind !== "knowledge" ? (
                          <ChevronRight
                            size={15}
                            className={`mindmap-chevron ${
                              effectivelyCollapsed.has(node.id) ? "" : "expanded"
                            }`}
                          />
                        ) : null}
                      </span>
                    </div>
                  </foreignObject>
                ))}
              </g>

            </svg>

            {hoveredNode && hoveredPopoverPosition ? (
              <div
                className="graph-popover graph-popover-floating"
                style={hoveredPopoverPosition}
              >
                <div className="graph-popover-kicker">
                  {hoveredNode.kind === "knowledge" ? "知识点预览" : "知识分支"}
                  {hoveredNode.difficulty ? (
                    <span className={`difficulty-badge difficulty-${hoveredNode.difficulty}`}>
                      {difficultyLabel(hoveredNode.difficulty)}
                    </span>
                  ) : null}
                </div>
                <strong>{hoveredNode.title}</strong>
                <p>
                  {hoveredNode.kind === "knowledge"
                    ? hoveredNode.summary
                    : `包含 ${hoveredNode.count} 个知识点。单击可展开或折叠这一分支。`}
                </p>
                <span>{hoveredNode.path}</span>
              </div>
            ) : null}

            {suggestions.length ? (
              <aside className="graph-suggestion-panel" aria-label="AI 语义关联建议">
                <div className="graph-suggestion-heading">
                  <strong>AI 语义关联</strong>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label="关闭语义关联建议"
                    onClick={() => {
                      setSuggestions([]);
                      setSemanticSourceId(null);
                    }}
                  >
                    <X size={15} />
                  </button>
                </div>
                <p>虚线表示跨分支建议，确认后才会写入知识网络。</p>
                <div className="graph-suggestion-list">
                  {suggestions.map((suggestion) => (
                    <article key={suggestion.id}>
                      <div>
                        <strong>{suggestion.title}</strong>
                        <span>{Math.round(suggestion.similarity * 100)}% 相似</span>
                      </div>
                      <small>{suggestion.path}</small>
                      <div className="graph-suggestion-actions">
                        <button
                          className="button compact"
                          type="button"
                          onClick={() =>
                            semanticSourceId &&
                            void createRelation(semanticSourceId, suggestion.id)
                          }
                        >
                          确认连接
                        </button>
                        <button
                          className="button ghost compact"
                          type="button"
                          onClick={() =>
                            setSuggestions((current) =>
                              current.filter((item) => item.id !== suggestion.id)
                            )
                          }
                        >
                          忽略
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </aside>
            ) : null}
          </div>
          <div className="graph-legend" aria-label="图谱图例">
            <span>
              <i className="legend-parent" /> 父级分支
            </span>
            <span>
              <i className="legend-leaf" /> 知识点
            </span>
            <span>
              <i className="legend-relation" /> 已有关系
            </span>
            <span>
              <i className="legend-manual" /> 手动关联
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function buildGraphNodes(
  tree: TreeResponse,
  knowledgeNodes: KnowledgeGraphNode[],
  collapsed: Set<string>,
  relationCounts: Map<string, number>,
  rootCollapsed: boolean
): GraphNode[] {
  const knowledgeById = new Map(knowledgeNodes.map((node) => [node.id, node]));
  const result: GraphNode[] = [];
  let cursorY = 100;

  function visitKnowledge(
    leaf: TreeNode | TreeResponse["uncategorized"][number],
    parentId: string,
    depth: number,
    path: string[],
    tone: number
  ) {
    const knowledge = knowledgeById.get(leaf.id);
    const size = measureGraphNode(leaf.name, "knowledge");
    const node: GraphNode = {
      id: leaf.id,
      title: leaf.name,
      kind: "knowledge",
      parentId,
      depth,
      x: 340 + depth * 370,
      y: cursorY,
      width: size.width,
      height: size.height,
      count: 1,
      relationCount: relationCounts.get(leaf.id) ?? 0,
      summary: knowledge?.summary ?? "暂无摘要",
      path: path.join(" / "),
      changed: leaf.changed,
      needsReview: leaf.needsReview,
      tone
    };
    cursorY += size.height + 28;
    result.push(node);
    return node;
  }

  function visitModule(
    module: TreeNode,
    parentId: string,
    depth: number,
    parentPath: string[],
    tone: number
  ): GraphNode {
    const path = [...parentPath, module.name];
    const childModules = (module.children ?? []).filter(
      (child) => child.kind !== "knowledge" && countKnowledge(child) > 0
    );
    const children = (module.children ?? []).filter(
      (child) => child.kind === "knowledge"
    );
    const expanded = !collapsed.has(module.id);
    const descendantNodes: GraphNode[] = [];
    if (expanded) {
      for (const child of childModules) {
        descendantNodes.push(visitModule(child, module.id, depth + 1, path, tone));
      }
      for (const child of children) {
        descendantNodes.push(visitKnowledge(child, module.id, depth + 1, path, tone));
      }
    }
    const size = measureGraphNode(module.name, "module");
    const y = descendantNodes.length
      ? averageCenter(descendantNodes) - size.height / 2
      : cursorY;
    if (!descendantNodes.length) cursorY += size.height + 34;
    const node: GraphNode = {
      id: module.id,
      title: module.name,
      kind: "module",
      parentId,
      depth,
      x: 330 + depth * 370,
      y,
      width: size.width,
      height: size.height,
      count: countKnowledge(module),
      relationCount: 0,
      summary: "",
      path: path.join(" / "),
      tone
    };
    result.push(node);
    return node;
  }

  const sourceModuleNodes = tree.tree.filter((module) => countKnowledge(module) > 0);
  const totalKnowledge =
    sourceModuleNodes.reduce((sum, module) => sum + countKnowledge(module), 0) +
    tree.uncategorized.length;
  const moduleNodes = rootCollapsed ? [] : sourceModuleNodes;
  const topNodes: GraphNode[] = [];
  moduleNodes.forEach((module, index) => {
    topNodes.push(visitModule(module, "graph-root", 0, [], index % 5));
  });
  if (!rootCollapsed && tree.uncategorized.length) {
    const synthetic: TreeNode = {
      id: "graph-uncategorized",
      name: "未分类",
      kind: "module",
      children: tree.uncategorized.map((node) => ({
        id: node.id,
        name: node.name,
        kind: "knowledge" as const,
        changed: node.changed,
        needsReview: node.needsReview
      }))
    };
    topNodes.push(
      visitModule(synthetic, "graph-root", 0, [], moduleNodes.length % 5)
    );
  }
  const rootSize = measureGraphNode("我的知识", "root");
  result.push({
    id: "graph-root",
    title: "我的知识",
    kind: "root",
    parentId: null,
    depth: 0,
    x: 40,
    y: topNodes.length
      ? averageCenter(topNodes) - rootSize.height / 2
      : cursorY,
    width: rootSize.width,
    height: rootSize.height,
    count: totalKnowledge,
    relationCount: 0,
    summary: "全部知识领域",
    path: "我的知识",
    tone: 0
  });
  return result;
}

function reflowParents(
  baseNodes: GraphNode[],
  aiPositions: SavedPositions,
  currentPositions: SavedPositions
) {
  const next = baseNodes.map((node) => {
    const position = aiPositions[node.id] ?? currentPositions[node.id];
    return {
      ...node,
      ...(position ?? {})
    };
  });
  const byId = new Map(next.map((node) => [node.id, node]));
  const parents = next
    .filter((node) => node.kind !== "knowledge")
    .sort((left, right) => right.depth - left.depth);
  for (const parent of parents) {
    const children = next.filter((node) => node.parentId === parent.id);
    if (!children.length) continue;
    const minX = Math.min(...children.map((child) => child.x));
    const centerY = averageCenter(children);
    const updated = {
      ...parent,
      x: minX - parent.width - 130,
      y: centerY - parent.height / 2
    };
    Object.assign(parent, updated);
    byId.set(parent.id, updated);
  }
  return next;
}

function edgePath(source: GraphNode, target: GraphNode) {
  const startX = source.x + source.width;
  const startY = source.y + source.height / 2;
  const endX = target.x;
  const endY = target.y + target.height / 2;
  const bend = Math.max(48, Math.abs(endX - startX) * 0.48);
  return `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`;
}

function crossEdgePath(source: GraphNode, target: GraphNode) {
  const startX = source.x + source.width / 2;
  const startY = source.y + source.height / 2;
  const endX = target.x + target.width / 2;
  const endY = target.y + target.height / 2;
  const middleX = (startX + endX) / 2;
  return `M ${startX} ${startY} C ${middleX} ${startY}, ${middleX} ${endY}, ${endX} ${endY}`;
}

function averageCenter(nodes: Array<{ y: number; height: number }>) {
  if (!nodes.length) return 0;
  return nodes.reduce((sum, node) => sum + node.y + node.height / 2, 0) / nodes.length;
}

function nearestKnowledgeNode(
  point: SavedPosition,
  nodes: GraphNode[],
  sourceId: string
) {
  return nodes.find(
    (node) =>
      node.kind === "knowledge" &&
      node.id !== sourceId &&
      point.x >= node.x &&
      point.x <= node.x + node.width &&
      point.y >= node.y &&
      point.y <= node.y + node.height
  );
}

function popoverPosition(
  node: GraphNode,
  viewport: Viewport,
  size: { width: number; height: number }
) {
  const screenLeft = ((node.x - viewport.x) / viewport.width) * size.width;
  const screenRight = ((node.x + node.width - viewport.x) / viewport.width) * size.width;
  const screenTop = ((node.y - viewport.y) / viewport.height) * size.height;
  const popoverWidth = 292;
  const gap = 14;
  return {
    left:
      screenRight + popoverWidth + gap <= size.width
        ? screenRight + gap
        : Math.max(10, screenLeft - popoverWidth - gap),
    top: Math.max(10, Math.min(size.height - 190, screenTop - 12))
  };
}

function difficultyLabel(value: number) {
  if (value >= 3) return "高级";
  if (value === 2) return "进阶";
  return "基础";
}

function allModuleIds(nodes: TreeNode[]): string[] {
  return nodes.flatMap((node) => [
    ...(node.kind !== "knowledge" ? [node.id] : []),
    ...allModuleIds(node.children ?? [])
  ]);
}

function MindMapList({
  modules,
  uncategorized
}: {
  modules: TreeNode[];
  uncategorized: TreeResponse["uncategorized"];
}) {
  return (
    <div className="panel panel-body">
      <ul className="mindmap-list">
        {modules.map((module) => (
          <ListModule key={module.id} node={module} />
        ))}
        {uncategorized.length ? (
          <li>
            <strong>未分类</strong>
            <ul>
              {uncategorized.map((node) => (
                <li key={node.id}>
                  <Link href={`/knowledge/${node.id}`}>{node.name}</Link>
                </li>
              ))}
            </ul>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function ListModule({ node }: { node: TreeNode }) {
  const modules = (node.children ?? []).filter((child) => child.kind !== "knowledge");
  const knowledge = (node.children ?? []).filter((child) => child.kind === "knowledge");
  return (
    <li>
      <strong>{node.name}</strong>
      <ul>
        {modules.map((module) => (
          <ListModule key={module.id} node={module} />
        ))}
        {knowledge.map((child) => (
          <li key={child.id}>
            <Link href={`/knowledge/${child.id}`}>{child.name}</Link>
            {child.changed ? <span className="badge accent">今日</span> : null}
          </li>
        ))}
      </ul>
    </li>
  );
}

function countKnowledge(node: TreeNode): number {
  if (node.kind === "knowledge") return 1;
  return (node.children ?? []).reduce((sum, child) => sum + countKnowledge(child), 0);
}
