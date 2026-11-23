"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const center = { x: 225, y: 193, width: 170, height: 78 };

const notes = [
  {
    id: "cpp",
    title: "C++ 多态",
    detail: "虚函数 · 继承",
    x: 46,
    y: 70,
    width: 176,
    height: 74,
    tone: "green"
  },
  {
    id: "network",
    title: "TCP 拥塞控制",
    detail: "慢启动 · 重传",
    x: 383,
    y: 64,
    width: 184,
    height: 74,
    tone: "slate"
  },
  {
    id: "process",
    title: "进程状态",
    detail: "就绪 · 阻塞 · 挂起",
    x: 48,
    y: 323,
    width: 190,
    height: 74,
    tone: "green"
  },
  {
    id: "review",
    title: "今日错题",
    detail: "3 个概念待复习",
    x: 390,
    y: 318,
    width: 184,
    height: 74,
    tone: "amber"
  }
] as const;

export function LoginVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [activeNote, setActiveNote] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    },
    []
  );

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * 620,
      y: ((event.clientY - rect.top) / Math.min(rect.height, rect.width * 0.71)) * 440
    };
    if (animationFrameRef.current) return;
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      setPointer(point);
      const closest = notes.find((note) => distance(point, nodeCenter(note)) < 112);
      setActiveNote(closest?.id ?? null);
    });
  }

  return (
    <div
      className="login-visual"
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => {
        setPointer(null);
        setActiveNote(null);
      }}
    >
      <svg
        aria-hidden="true"
        className="login-visual-svg"
        viewBox="0 0 620 440"
        role="img"
      >
        <defs>
          <pattern id="login-paper-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" className="login-paper-line" />
          </pattern>
        </defs>
        <rect width="620" height="440" rx="20" className="login-visual-paper" />
        <rect width="620" height="440" rx="20" fill="url(#login-paper-grid)" />
        <path d="M34 20V420" className="login-margin-line" />

        {notes.map((note, index) => {
          const active = activeNote === note.id;
          return (
            <path
              className={`login-knowledge-link ${active ? "is-active" : ""}`}
              d={connectionPath(note, pointer, index)}
              key={`line-${note.id}`}
            />
          );
        })}

        {pointer ? (
          <path
            className="login-companion-link"
            d={`M ${center.x + center.width / 2} ${center.y + center.height / 2} Q ${
              (center.x + center.width / 2 + pointer.x) / 2
            } ${Math.min(center.y, pointer.y) - 20} ${pointer.x} ${pointer.y}`}
          />
        ) : null}

        <g className="login-center-node">
          <rect
            fill="#223b33"
            height={center.height}
            rx="15"
            width={center.width}
            x={center.x}
            y={center.y}
          />
          <circle cx={center.x + 24} cy={center.y + 26} r="5" fill="#7fc1aa" />
          <text className="login-center-title" x={center.x + 40} y={center.y + 31}>
            知伴
          </text>
          <text className="login-center-caption" x={center.x + 24} y={center.y + 57}>
            正在和你一起整理
          </text>
        </g>

        {notes.map((note, index) => {
          const offset = pointerOffset(note, pointer);
          const active = activeNote === note.id;
          return (
            <foreignObject
              className="login-note-object"
              height={note.height + 18}
              key={note.id}
              width={note.width + 18}
              x={note.x - 9}
              y={note.y - 9}
            >
              <div
                className={`login-note-card tone-${note.tone} ${active ? "is-active" : ""}`}
                onPointerEnter={() => setActiveNote(note.id)}
                onPointerLeave={() => setActiveNote(null)}
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                  animationDelay: `${index * 55 + 80}ms`
                }}
              >
                <span className="login-note-title">{note.title}</span>
                <span className="login-note-detail">{note.detail}</span>
              </div>
            </foreignObject>
          );
        })}

        {pointer ? (
          <g
            className="login-companion-cursor"
            transform={`translate(${pointer.x} ${pointer.y})`}
          >
            <circle r="17" />
            <circle className="login-companion-core" r="5" />
            <text x="24" y="5">
              知伴
            </text>
          </g>
        ) : null}
      </svg>
      <div className="login-visual-caption">
        <span className="status-dot" />
        整理笔记 · 建立关联 · 准备复习
      </div>
    </div>
  );
}

function nodeCenter(note: (typeof notes)[number]) {
  return { x: note.x + note.width / 2, y: note.y + note.height / 2 };
}

function distance(left: { x: number; y: number }, right: { x: number; y: number }) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function pointerOffset(
  note: (typeof notes)[number],
  pointer: { x: number; y: number } | null
) {
  if (!pointer) return { x: 0, y: 0 };
  const node = nodeCenter(note);
  const dx = pointer.x - node.x;
  const dy = pointer.y - node.y;
  const dist = Math.hypot(dx, dy);
  if (dist > 240 || dist === 0) return { x: 0, y: 0 };
  const strength = (1 - dist / 240) * 7;
  return { x: (dx / dist) * strength, y: (dy / dist) * strength };
}

function connectionPath(
  note: (typeof notes)[number],
  pointer: { x: number; y: number } | null,
  index: number
) {
  const node = nodeCenter(note);
  const start = {
    x: center.x + center.width / 2,
    y: center.y + center.height / 2
  };
  const bend = index % 2 ? 34 : -34;
  const pointerBend = pointer
    ? Math.max(-16, Math.min(16, (pointer.y - (start.y + node.y) / 2) * 0.035))
    : 0;
  return `M ${start.x} ${start.y} C ${(start.x + node.x) / 2} ${
    start.y + bend + pointerBend
  }, ${(start.x + node.x) / 2} ${node.y - bend + pointerBend}, ${node.x} ${node.y}`;
}
