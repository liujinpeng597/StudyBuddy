export type PositionedNode = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SavedPosition = {
  x: number;
  y: number;
};

export function measureGraphNode(
  label: string,
  kind: "root" | "module" | "knowledge"
): { width: number; height: number } {
  const textWidth = [...label].reduce(
    (width, character) => width + (/[\u2e80-\u9fff]/u.test(character) ? 15 : 8.2),
    0
  );
  const minimum = kind === "root" ? 184 : 190;
  const maximum = kind === "root" ? 238 : 330;
  return {
    width: Math.round(Math.min(maximum, Math.max(minimum, textWidth + 74))),
    height: kind === "root" ? 78 : kind === "module" ? 56 : 50
  };
}

export function resolveGraphCollisions<T extends PositionedNode>(
  input: T[],
  padding = 24
): T[] {
  const nodes = input.map((node) => ({ ...node }));
  for (let iteration = 0; iteration < 80; iteration += 1) {
    let moved = false;
    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const left = nodes[leftIndex]!;
        const right = nodes[rightIndex]!;
        const leftCenter = {
          x: left.x + left.width / 2,
          y: left.y + left.height / 2
        };
        const rightCenter = {
          x: right.x + right.width / 2,
          y: right.y + right.height / 2
        };
        const deltaX = rightCenter.x - leftCenter.x;
        const deltaY = rightCenter.y - leftCenter.y;
        const overlapX =
          (left.width + right.width) / 2 + padding - Math.abs(deltaX);
        const overlapY =
          (left.height + right.height) / 2 + padding - Math.abs(deltaY);
        if (overlapX <= 0 || overlapY <= 0) continue;

        moved = true;
        if (overlapX < overlapY) {
          const direction = deltaX === 0 ? (leftIndex % 2 ? -1 : 1) : Math.sign(deltaX);
          const shift = overlapX / 2 + 0.5;
          left.x -= shift * direction;
          right.x += shift * direction;
        } else {
          const direction = deltaY === 0 ? (rightIndex % 2 ? -1 : 1) : Math.sign(deltaY);
          const shift = overlapY / 2 + 0.5;
          left.y -= shift * direction;
          right.y += shift * direction;
        }
      }
    }
    if (!moved) break;
  }
  return nodes;
}

export function graphBounds(nodes: PositionedNode[]) {
  if (!nodes.length) return { minX: 0, minY: 0, maxX: 800, maxY: 600 };
  return nodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.x),
      minY: Math.min(bounds.minY, node.y),
      maxX: Math.max(bounds.maxX, node.x + node.width),
      maxY: Math.max(bounds.maxY, node.y + node.height)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
}
