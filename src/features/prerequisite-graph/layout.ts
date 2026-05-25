export type GraphTopic = { id: number; name: string };
export type Edge = { from: number; to: number };
export type PositionedNode = GraphTopic & { x: number; y: number };

export const NODE_W = 182;
export const NODE_H = 30;
export const PAD = 20;

const STEP_X = NODE_W + PAD;
const STEP_Y = NODE_H + PAD;

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

type AdjMaps = {
  children: Record<number, Set<number>>;
  parents: Record<number, Set<number>>;
};

function buildAdjMaps(edges: Edge[]): AdjMaps {
  const children: Record<number, Set<number>> = {};
  const parents: Record<number, Set<number>> = {};
  for (const { from, to } of edges) {
    (children[from] ??= new Set()).add(to);
    (parents[to] ??= new Set()).add(from);
  }
  return { children, parents };
}

function findClusters(edges: Edge[]): Set<number>[] {
  const clusters: Set<number>[] = [];
  for (const { from, to } of edges) {
    const matches = clusters.filter((c) => c.has(from) || c.has(to));
    if (matches.length === 0) {
      clusters.push(new Set([from, to]));
      continue;
    }
    const [merged, ...rest] = matches;
    merged!.add(from);
    merged!.add(to);
    for (const c of rest) {
      c.forEach((id) => merged!.add(id));
      clusters.splice(clusters.indexOf(c), 1);
    }
  }
  return clusters.sort((a, b) => b.size - a.size);
}

function findRoots(cluster: Set<number>, parents: Record<number, Set<number>>) {
  const roots: number[] = [];
  for (const id of cluster) {
    if (!parents[id]) roots.push(id);
  }
  return roots.length > 0 ? roots : [[...cluster][0]!];
}

function bfsDescendants(
  rootId: number,
  children: Record<number, Set<number>>,
  inCluster: Set<number>,
): Set<number> {
  const descendants = new Set<number>();
  const queue = [...(children[rootId] ?? [])].filter((c) => inCluster.has(c));
  const seen = new Set<number>();
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    descendants.add(id);
    for (const c of children[id] ?? []) {
      if (inCluster.has(c)) queue.push(c);
    }
  }
  return descendants;
}

// ---------------------------------------------------------------------------
// Root ordering heuristics
// ---------------------------------------------------------------------------

function orderRoots(
  roots: number[],
  children: Record<number, Set<number>>,
  descendantsByRoot: Map<number, Set<number>>,
) {
  // 1. Sort by outdegree descending
  roots.sort((a, b) => (children[b]?.size ?? 0) - (children[a]?.size ?? 0));

  // 2. Bubble up roots whose direct children appear in the preceding root's
  //    deeper levels (reduces crossings between adjacent groups).
  for (let i = 1; i < roots.length; i++) {
    let j = i;
    while (j > 0) {
      const cur = roots[j]!;
      const prev = roots[j - 1]!;
      const prevDesc = descendantsByRoot.get(prev) ?? new Set();
      const shouldMoveUp = [...(children[cur] ?? [])].some((c) =>
        prevDesc.has(c),
      );
      if (!shouldMoveUp) break;
      roots[j] = prev;
      roots[j - 1] = cur;
      j--;
    }
  }

  // 3. Keep strongest root first, then sort others by overlap with top root.
  const [top, ...rest] = roots;
  if (top === undefined) return;
  const topDesc = descendantsByRoot.get(top) ?? new Set<number>();
  rest.sort((a, b) => {
    const scoreA = [...(descendantsByRoot.get(a) ?? [])].filter((id) =>
      topDesc.has(id),
    ).length;
    const scoreB = [...(descendantsByRoot.get(b) ?? [])].filter((id) =>
      topDesc.has(id),
    ).length;
    return scoreB - scoreA;
  });
  roots.splice(0, roots.length, top, ...rest);
}

// ---------------------------------------------------------------------------
// Per-root BFS placement
// ---------------------------------------------------------------------------

function placeRootSubtree(
  rootId: number,
  rootRow: number,
  adj: AdjMaps,
  inCluster: Set<number>,
  directChildrenOfAnyRoot: Set<number>,
  maxPrecedingNonLeafLevel: number,
  unpositioned: Set<number>,
  placedById: Map<number, PositionedNode>,
  nameMap: Record<number, string>,
): { nodes: PositionedNode[]; maxRows: number; maxNonLeafLevel: number } {
  const { children, parents } = adj;

  // BFS to assign levels, revisiting at deeper levels
  const traversed = new Map<number, number>();
  const levelById = new Map<number, number>();
  const queue: Array<{ id: number; level: number }> = [];
  const maxLevel = inCluster.size;

  const enqueueChildren = (parentId: number, level: number) => {
    const kids = [...(children[parentId] ?? [])].sort(
      (a, b) => (children[b]?.size ?? 0) - (children[a]?.size ?? 0),
    );
    for (const c of kids) {
      if (inCluster.has(c)) queue.push({ id: c, level });
    }
  };

  enqueueChildren(rootId, 1);

  while (queue.length > 0) {
    const next = queue.shift()!;
    if (next.level > maxLevel) continue;
    if (next.level <= (traversed.get(next.id) ?? -1)) continue;
    traversed.set(next.id, next.level);

    // Already placed by an earlier root — maybe push leaf right
    const existing = placedById.get(next.id);
    if (existing) {
      const isLeaf = (children[next.id]?.size ?? 0) === 0;
      const hasMultipleParents = (parents[next.id]?.size ?? 0) > 1;
      if (isLeaf && hasMultipleParents) {
        const curLevel = Math.round(existing.x / STEP_X);
        let maxParLevel = -1;
        for (const pid of parents[next.id] ?? []) {
          const placed = placedById.get(pid);
          if (placed) {
            maxParLevel = Math.max(maxParLevel, Math.round(placed.x / STEP_X));
          } else {
            const inProgress = levelById.get(pid);
            if (inProgress !== undefined)
              maxParLevel = Math.max(maxParLevel, inProgress);
          }
        }
        const desired = maxParLevel >= 0 ? maxParLevel + 1 : next.level;
        if (desired > curLevel) existing.x = desired * STEP_X;
      }
      enqueueChildren(next.id, next.level + 1);
      continue;
    }

    if (!unpositioned.has(next.id)) continue;
    if (next.level <= (levelById.get(next.id) ?? -1)) continue;
    levelById.set(next.id, next.level);
    enqueueChildren(next.id, next.level + 1);
  }

  // Group by level, snapping direct-child leaves to level 1
  const byLevel: Record<number, number[]> = {};
  const isLeaf = new Map<number, boolean>();
  for (const [id, level] of levelById.entries()) {
    unpositioned.delete(id);
    const leaf = (children[id]?.size ?? 0) === 0;
    isLeaf.set(id, leaf);
    const effectiveLevel = leaf && directChildrenOfAnyRoot.has(id) ? 1 : level;
    (byLevel[effectiveLevel] ??= []).push(id);
  }

  // Push multi-parent leaves to a target level (avoids double-arrow edges)
  const levels = Object.keys(byLevel)
    .map(Number)
    .sort((a, b) => a - b);
  const maxNonLeafLevel = levels.reduce(
    (max, l) =>
      (byLevel[l] ?? []).some((id) => !isLeaf.get(id)) ? Math.max(max, l) : max,
    0,
  );
  const leafTarget = Math.min(
    maxPrecedingNonLeafLevel + 1,
    maxNonLeafLevel + 1,
  );
  const movedLeaves: number[] = [];
  for (const l of levels) {
    const ids = byLevel[l]!;
    const keep: number[] = [];
    for (const id of ids) {
      if (
        isLeaf.get(id) &&
        (parents[id]?.size ?? 0) > 1 &&
        !directChildrenOfAnyRoot.has(id) &&
        l < leafTarget
      ) {
        movedLeaves.push(id);
      } else {
        keep.push(id);
      }
    }
    byLevel[l] = keep;
  }
  if (movedLeaves.length > 0) {
    (byLevel[leafTarget] ??= []).push(...movedLeaves);
  }

  // Place nodes
  const nodes: PositionedNode[] = [];
  let maxRows = 1;
  const finalLevels = Object.keys(byLevel)
    .map(Number)
    .sort((a, b) => a - b);
  for (const l of finalLevels) {
    const ids = byLevel[l]!;
    maxRows = Math.max(maxRows, ids.length);
    for (const [row, id] of ids.entries()) {
      const node: PositionedNode = {
        id,
        name: nameMap[id]!,
        x: l * STEP_X,
        y: (rootRow + row) * STEP_Y,
      };
      nodes.push(node);
      placedById.set(id, node);
    }
  }

  return { nodes, maxRows, maxNonLeafLevel };
}

// ---------------------------------------------------------------------------
// Crossing minimization (post-processing)
// ---------------------------------------------------------------------------

type Seg = { x1: number; y1: number; x2: number; y2: number };

function segsIntersect(s1: Seg, s2: Seg): boolean {
  if (
    (s1.x1 === s2.x1 && s1.y1 === s2.y1) ||
    (s1.x1 === s2.x2 && s1.y1 === s2.y2) ||
    (s1.x2 === s2.x1 && s1.y2 === s2.y1) ||
    (s1.x2 === s2.x2 && s1.y2 === s2.y2)
  )
    return false;
  const cp = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
    px: number,
    py: number,
  ) => (bx - ax) * (py - ay) - (by - ay) * (px - ax);
  const d1 = cp(s2.x1, s2.y1, s2.x2, s2.y2, s1.x1, s1.y1);
  const d2 = cp(s2.x1, s2.y1, s2.x2, s2.y2, s1.x2, s1.y2);
  const d3 = cp(s1.x1, s1.y1, s1.x2, s1.y2, s2.x1, s2.y1);
  const d4 = cp(s1.x1, s1.y1, s1.x2, s1.y2, s2.x2, s2.y2);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

export function countCrossings(nodes: PositionedNode[], edges: Edge[]): number {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const segs = edges.flatMap((e) => {
    const a = byId.get(e.from),
      b = byId.get(e.to);
    return a && b ? [{ x1: a.x, y1: a.y, x2: b.x, y2: b.y }] : [];
  });
  let c = 0;
  for (let i = 0; i < segs.length; i++)
    for (let j = i + 1; j < segs.length; j++)
      if (segsIntersect(segs[i]!, segs[j]!)) c++;
  return c;
}

/** Swap entire root groups vertically, keeping swaps that reduce crossings. */
function swapRootGroups(
  pos: PositionedNode[],
  edges: Edge[],
  rootOwner: Map<number, number>,
) {
  const groups = new Map<number, PositionedNode[]>();
  for (const n of pos) {
    const r = rootOwner.get(n.id);
    if (r === undefined) continue;
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(n);
  }
  const rootIds = [...groups.keys()];
  if (rootIds.length < 2) return;

  rootIds.sort((a, b) => {
    const minA = Math.min(...groups.get(a)!.map((n) => n.y));
    const minB = Math.min(...groups.get(b)!.map((n) => n.y));
    return minA - minB;
  });

  let cur = countCrossings(pos, edges);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < rootIds.length - 1; i++) {
      const grpA = groups.get(rootIds[i]!)!;
      const grpB = groups.get(rootIds[i + 1]!)!;
      const savedA = grpA.map((n) => n.y);
      const savedB = grpB.map((n) => n.y);
      const minA = Math.min(...savedA);
      const minB = Math.min(...savedB);
      const heightB = Math.max(...savedB) - minB + STEP_Y;

      for (const n of grpB) n.y = n.y - minB + minA;
      for (const n of grpA) n.y = n.y - minA + minA + heightB;

      const newC = countCrossings(pos, edges);
      if (newC < cur) {
        cur = newC;
        improved = true;
        [rootIds[i], rootIds[i + 1]] = [rootIds[i + 1]!, rootIds[i]!];
      } else {
        grpA.forEach((n, k) => (n.y = savedA[k]!));
        grpB.forEach((n, k) => (n.y = savedB[k]!));
      }
    }
  }
}

/** Swap node y-positions within each root group + level to reduce crossings. */
function swapWithinGroups(
  pos: PositionedNode[],
  edges: Edge[],
  rootOwner: Map<number, number>,
) {
  const byX = new Map<number, PositionedNode[]>();
  for (const n of pos) {
    if (!byX.has(n.x)) byX.set(n.x, []);
    byX.get(n.x)!.push(n);
  }

  let cur = countCrossings(pos, edges);
  let improved = true;
  while (improved) {
    improved = false;
    for (const [, nodes] of byX) {
      for (let i = 0; i < nodes.length - 1; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i]!,
            b = nodes[j]!;
          if (rootOwner.get(a.id) !== rootOwner.get(b.id)) continue;
          const tmpY = a.y;
          a.y = b.y;
          b.y = tmpY;
          const newC = countCrossings(pos, edges);
          if (newC < cur) {
            cur = newC;
            improved = true;
          } else {
            b.y = a.y;
            a.y = tmpY;
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function assignManualPositions(
  topics: GraphTopic[],
  edges: Edge[],
): PositionedNode[] {
  if (topics.length === 0) return [];

  const nameMap: Record<number, string> = Object.fromEntries(
    topics.map(({ id, name }) => [id, name]),
  );
  const adj = buildAdjMaps(edges);
  const clusters = findClusters(edges);
  const unpositioned = new Set(topics.map(({ id }) => id));
  const placedById = new Map<number, PositionedNode>();
  const pos: PositionedNode[] = [];
  const rootOwner = new Map<number, number>();
  let offset = 0;

  for (const cluster of clusters) {
    const roots = findRoots(cluster, adj.parents);
    const descendantsByRoot = new Map(
      roots.map((r) => [r, bfsDescendants(r, adj.children, cluster)]),
    );
    orderRoots(roots, adj.children, descendantsByRoot);

    const directChildrenOfAnyRoot = new Set<number>();
    for (const r of roots) {
      for (const c of adj.children[r] ?? []) directChildrenOfAnyRoot.add(c);
    }

    let maxPrecedingNonLeafLevel = 0;
    for (const rootId of roots) {
      if (!unpositioned.has(rootId)) continue;

      const rootRow = offset;
      unpositioned.delete(rootId);
      const rootNode: PositionedNode = {
        id: rootId,
        name: nameMap[rootId]!,
        x: 0,
        y: rootRow * STEP_Y,
      };
      pos.push(rootNode);
      placedById.set(rootId, rootNode);
      rootOwner.set(rootId, rootId);

      const { nodes, maxRows, maxNonLeafLevel } = placeRootSubtree(
        rootId,
        rootRow,
        adj,
        cluster,
        directChildrenOfAnyRoot,
        maxPrecedingNonLeafLevel,
        unpositioned,
        placedById,
        nameMap,
      );
      for (const n of nodes) {
        pos.push(n);
        rootOwner.set(n.id, rootId);
      }
      maxPrecedingNonLeafLevel = Math.max(
        maxPrecedingNonLeafLevel,
        maxNonLeafLevel,
      );
      offset = Math.max(offset + 1, rootRow + maxRows);
    }
    offset += 1;
  }

  // Crossing reduction (preserves sub-group structure)
  swapRootGroups(pos, edges, rootOwner);
  swapWithinGroups(pos, edges, rootOwner);

  // Unconnected nodes (no edges)
  const cols = 6;
  for (const [r, id] of [...unpositioned].entries()) {
    pos.push({
      id,
      name: nameMap[id]!,
      x: (r % cols) * STEP_X,
      y: (Math.floor(r / cols) + offset) * STEP_Y,
    });
  }
  return pos;
}

export function edgePath(from: PositionedNode, to: PositionedNode): string {
  const fromCx = from.x + NODE_W / 2;
  const fromCy = from.y + NODE_H / 2;
  const toCx = to.x + NODE_W / 2;
  const toCy = to.y + NODE_H / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  const edgePoint = (cx: number, cy: number, vx: number, vy: number) => {
    if (vx === 0 && vy === 0) return { x: cx, y: cy };
    const sx = vx === 0 ? Infinity : NODE_W / 2 / Math.abs(vx);
    const sy = vy === 0 ? Infinity : NODE_H / 2 / Math.abs(vy);
    const t = Math.min(sx, sy);
    return { x: cx + vx * t, y: cy + vy * t };
  };

  const start = edgePoint(fromCx, fromCy, dx, dy);
  const end = edgePoint(toCx, toCy, -dx, -dy);
  return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
}
