import { describe, expect, test } from "vitest";
import {
  measureGraphNode,
  resolveGraphCollisions,
  type PositionedNode
} from "./layout";

describe("graph layout", () => {
  test("node width grows with the title and remains bounded", () => {
    const short = measureGraphNode("PCB", "knowledge");
    const long = measureGraphNode("进程间通信中的共享内存与消息队列对比", "knowledge");
    expect(long.width).toBeGreaterThan(short.width);
    expect(long.width).toBeLessThanOrEqual(330);
  });

  test("collision resolution separates overlapping cards", () => {
    const nodes: PositionedNode[] = [
      { id: "a", x: 100, y: 100, width: 260, height: 50 },
      { id: "b", x: 120, y: 108, width: 280, height: 50 },
      { id: "c", x: 108, y: 116, width: 220, height: 50 }
    ];
    const resolved = resolveGraphCollisions(nodes);
    for (let left = 0; left < resolved.length; left += 1) {
      for (let right = left + 1; right < resolved.length; right += 1) {
        const a = resolved[left]!;
        const b = resolved[right]!;
        const overlaps =
          Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
          Math.abs(a.y - b.y) < (a.height + b.height) / 2;
        expect(overlaps).toBe(false);
      }
    }
  });
});
