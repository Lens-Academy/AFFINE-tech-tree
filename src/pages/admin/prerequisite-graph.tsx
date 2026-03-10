import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { AuthHeader } from "~/components/AuthHeader";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/utils/api";

type Node = { id: number; name: string; x: number; y: number };
type Edge = { from: number; to: number };

const NODE_W = 160;
const NODE_H = 30;
const FONT_SIZE = 14;

/**
 * Topological layering, then optimize node order WITHIN each layer
 * to minimize circular edge distance (fewer crossings), while preserving
 * clockwise topo order (layer 0 first, then layer 1, etc.).
 */
function topoCircleOrder(
  rawNodes: Array<{ id: number; name: string }>,
  edges: Edge[],
): Array<{ id: number; name: string }> {
  if (rawNodes.length === 0) return [];

  // Directed adjacency + in-degree for topo layers
  const fwd = new Map<number, number[]>();
  const inDeg = new Map<number, number>();
  for (const nd of rawNodes) {
    fwd.set(nd.id, []);
    inDeg.set(nd.id, 0);
  }
  for (const e of edges) {
    fwd.get(e.from)?.push(e.to);
    inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
  }

  // Kahn's algorithm to assign layers
  const layer = new Map<number, number>();
  const queue: number[] = [];
  for (const nd of rawNodes) {
    if ((inDeg.get(nd.id) ?? 0) === 0) {
      queue.push(nd.id);
      layer.set(nd.id, 0);
    }
  }
  if (queue.length === 0 && rawNodes.length > 0) {
    queue.push(rawNodes[0]!.id);
    layer.set(rawNodes[0]!.id, 0);
  }
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const curLayer = layer.get(cur) ?? 0;
    for (const next of fwd.get(cur) ?? []) {
      const existing = layer.get(next);
      if (existing === undefined || existing < curLayer + 1) {
        layer.set(next, curLayer + 1);
      }
      if (existing === undefined) {
        queue.push(next);
      }
    }
  }
  let maxLayer = 0;
  for (const v of layer.values()) maxLayer = Math.max(maxLayer, v);
  for (const nd of rawNodes) {
    if (!layer.has(nd.id)) layer.set(nd.id, ++maxLayer);
  }

  // Group by layer
  const layers = new Map<number, number[]>();
  for (const nd of rawNodes) {
    const l = layer.get(nd.id) ?? 0;
    if (!layers.has(l)) layers.set(l, []);
    layers.get(l)!.push(nd.id);
  }
  const sortedLayers = [...layers.entries()].sort((a, b) => a[0] - b[0]);

  // Build undirected adjacency for neighbor-closeness scoring
  const adj = new Map<number, Set<number>>();
  for (const nd of rawNodes) adj.set(nd.id, new Set());
  for (const e of edges) {
    adj.get(e.from)?.add(e.to);
    adj.get(e.to)?.add(e.from);
  }

  // Flatten layers in order; within each layer, sort nodes so they're
  // close to their already-placed neighbors
  const result: number[] = [];
  const posOf = new Map<number, number>();

  for (const [, ids] of sortedLayers) {
    if (result.length === 0) {
      // First layer - sort by number of connections descending
      ids.sort((a, b) => (adj.get(b)?.size ?? 0) - (adj.get(a)?.size ?? 0));
    } else {
      // Sort by average position of already-placed neighbors
      const avgNeighborPos = (id: number) => {
        const neighbors = adj.get(id);
        if (!neighbors) return result.length;
        let sum = 0;
        let count = 0;
        for (const nb of neighbors) {
          const p = posOf.get(nb);
          if (p !== undefined) {
            sum += p;
            count++;
          }
        }
        return count > 0 ? sum / count : result.length;
      };
      ids.sort((a, b) => avgNeighborPos(a) - avgNeighborPos(b));
    }
    for (const id of ids) {
      posOf.set(id, result.length);
      result.push(id);
    }
  }

  const byId = new Map(rawNodes.map((nd) => [nd.id, nd]));
  return result.map((id) => byId.get(id)!);
}

function ellipseLayout(
  rawNodes: Array<{ id: number; name: string }>,
  edges: Edge[],
): Node[] {
  if (rawNodes.length === 0) return [];
  const ordered = topoCircleOrder(rawNodes, edges);
  const n = ordered.length;
  // Tight but non-overlapping spacing between node pills.
  const minSpacing = NODE_W - 30;
  // Approximate ellipse perimeter needed
  const perimNeeded = n * minSpacing;
  // For a 2:1 ellipse (rx = 2*ry), perimeter ≈ π * (3(rx+ry) - sqrt((3rx+ry)(rx+3ry)))
  // Simpler: just scale ry so the Ramanujan approx matches
  // Start small and grow only as needed so spacing controls actually apply.
  let ry = 120;
  for (let i = 0; i < 20; i++) {
    const rx = ry * 2;
    const h = ((rx - ry) * (rx - ry)) / ((rx + ry) * (rx + ry));
    const perim =
      Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
    if (perim >= perimNeeded) break;
    ry = ry * 1.15;
  }
  const rx = ry * 2;
  return ordered.map((node, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return {
      id: node.id,
      name: node.name,
      x: rx * Math.cos(angle) - NODE_W / 2,
      y: ry * Math.sin(angle) - NODE_H / 2,
    };
  });
}

/** Curved path between node rects */
function edgePath(from: Node, to: Node, curvature: number): string {
  const fcx = from.x + NODE_W / 2;
  const fcy = from.y + NODE_H / 2;
  const tcx = to.x + NODE_W / 2;
  const tcy = to.y + NODE_H / 2;

  const mx = (fcx + tcx) / 2;
  const my = (fcy + tcy) / 2;
  const dx = tcx - fcx;
  const dy = tcy - fcy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const px = mx + (-dy / len) * curvature;
  const py = my + (dx / len) * curvature;

  const clip = (
    cx: number,
    cy: number,
    fromX: number,
    fromY: number,
    hw: number,
    hh: number,
  ) => {
    const ddx = fromX - cx;
    const ddy = fromY - cy;
    if (Math.abs(ddx) < 0.01 && Math.abs(ddy) < 0.01)
      return { x: cx - hw, y: cy };
    const scale = Math.min(
      hw / Math.abs(ddx || 0.01),
      hh / Math.abs(ddy || 0.01),
    );
    return { x: cx + ddx * scale, y: cy + ddy * scale };
  };

  const startPt = clip(fcx, fcy, px, py, NODE_W / 2, NODE_H / 2);
  const endPt = clip(tcx, tcy, px, py, NODE_W / 2, NODE_H / 2);

  // Arrow gap
  const edx = endPt.x - px;
  const edy = endPt.y - py;
  const elen = Math.sqrt(edx * edx + edy * edy) || 1;
  endPt.x -= (edx / elen) * 8;
  endPt.y -= (edy / elen) * 8;

  return `M ${startPt.x} ${startPt.y} Q ${px} ${py} ${endPt.x} ${endPt.y}`;
}

export default function PrerequisiteGraphPage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: adminStatus } = api.admin.getAdminStatus.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const { data: graph, isLoading } = api.admin.prerequisiteGraph.useQuery(
    undefined,
    { enabled: !!adminStatus?.isAdmin },
  );
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Camera state as a ref for smooth interaction, synced to render state
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 600 });
  const dragging = useRef(false);
  const dragLast = useRef({ x: 0, y: 0 });

  const nodes = useMemo(
    () => (graph ? ellipseLayout(graph.nodes, graph.edges) : []),
    [graph],
  );
  const edges = useMemo(() => graph?.edges ?? [], [graph]);

  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const edgeCurvatures = useMemo(() => {
    const pairCount = new Map<string, number>();
    const pairIndex = new Map<string, number>();
    for (const e of edges) {
      const key = [Math.min(e.from, e.to), Math.max(e.from, e.to)].join("-");
      pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
    }
    return edges.map((e) => {
      const key = [Math.min(e.from, e.to), Math.max(e.from, e.to)].join("-");
      const count = pairCount.get(key) ?? 1;
      if (count <= 1) return 0;
      const idx = pairIndex.get(key) ?? 0;
      pairIndex.set(key, idx + 1);
      return idx === 0 ? 40 : -40;
    });
  }, [edges]);

  // Fit full graph on data load
  useEffect(() => {
    if (nodes.length === 0) return;
    const pad = 40;
    const x0 = Math.min(...nodes.map((n) => n.x)) - pad;
    const y0 = Math.min(...nodes.map((n) => n.y)) - pad;
    const x1 = Math.max(...nodes.map((n) => n.x)) + NODE_W + pad;
    const y1 = Math.max(...nodes.map((n) => n.y)) + NODE_H + pad;
    setViewBox({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }, [nodes]);

  const svgScale = useCallback(() => {
    const el = containerRef.current;
    if (!el) return 1;
    return viewBox.w / el.clientWidth;
  }, [viewBox.w]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragLast.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging.current) return;
      const scale = svgScale();
      const dx = (e.clientX - dragLast.current.x) * scale;
      const dy = (e.clientY - dragLast.current.y) * scale;
      dragLast.current = { x: e.clientX, y: e.clientY };
      setViewBox((vb) => ({ ...vb, x: vb.x - dx, y: vb.y - dy }));
    },
    [svgScale],
  );

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const el = containerRef.current;
      if (!el) return;
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      const rect = el.getBoundingClientRect();
      // Mouse position in SVG coords
      const scale = svgScale();
      const mx = viewBox.x + (e.clientX - rect.left) * scale;
      const my = viewBox.y + (e.clientY - rect.top) * scale;
      setViewBox((vb) => {
        const nw = vb.w * factor;
        const nh = vb.h * factor;
        return {
          x: mx - (mx - vb.x) * factor,
          y: my - (my - vb.y) * factor,
          w: nw,
          h: nh,
        };
      });
    },
    [svgScale, viewBox.x, viewBox.y],
  );

  useEffect(() => {
    const handler = () => {
      dragging.current = false;
    };
    window.addEventListener("mouseup", handler);
    return () => window.removeEventListener("mouseup", handler);
  }, []);

  const isEdgeHighlighted = (e: Edge) =>
    hoveredNode !== null && (e.from === hoveredNode || e.to === hoveredNode);

  const resetView = useCallback(() => {
    if (nodes.length === 0) return;
    const pad = 40;
    const x0 = Math.min(...nodes.map((n) => n.x)) - pad;
    const y0 = Math.min(...nodes.map((n) => n.y)) - pad;
    const x1 = Math.max(...nodes.map((n) => n.x)) + NODE_W + pad;
    const y1 = Math.max(...nodes.map((n) => n.y)) + NODE_H + pad;
    setViewBox({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }, [nodes]);

  return (
    <>
      <Head>
        <title>Prerequisite Graph | Admin | AFFINE Tech Tree</title>
      </Head>
      <main className="flex h-screen flex-col bg-zinc-950">
        <header className="shrink-0 border-b border-zinc-800/80 px-4 py-3 md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/admin"
                className="text-sm text-zinc-500 hover:text-zinc-300"
              >
                Admin
              </Link>
              <span className="text-zinc-700">/</span>
              <span className="text-sm text-zinc-300">Prerequisite Graph</span>
            </div>
            <AuthHeader />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 md:px-8">
          {sessionPending && (
            <p className="text-zinc-500">Loading session...</p>
          )}
          {!sessionPending && !session?.user && (
            <p className="text-zinc-400">
              Please sign in to access admin features.
            </p>
          )}
          {session?.user && adminStatus && !adminStatus.isAdmin && (
            <p className="text-zinc-400">Admin access required.</p>
          )}
          {isLoading && adminStatus?.isAdmin && (
            <p className="text-zinc-500">Loading graph...</p>
          )}
          {graph && edges.length === 0 && (
            <p className="text-zinc-500">
              No topics with prerequisites found. Run sync first.
            </p>
          )}
          {graph && nodes.length > 0 && (
            <>
              <div className="mb-2 flex items-start justify-between gap-3">
                <p className="text-sm text-zinc-500">
                  {nodes.length} topics, {edges.length} edges - arrows point
                  from prerequisite to dependent
                </p>
                <button
                  type="button"
                  onClick={resetView}
                  className="shrink-0 rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
                >
                  Reset view
                </button>
              </div>
              <div
                ref={containerRef}
                className="flex-1 cursor-grab overflow-hidden rounded border border-zinc-800 active:cursor-grabbing"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onWheel={handleWheel}
              >
                <svg
                  viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                  className="h-full w-full"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="8"
                      markerHeight="6"
                      refX="8"
                      refY="3"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 8 3, 0 6"
                        fill="currentColor"
                        className="text-zinc-600"
                      />
                    </marker>
                    <marker
                      id="arrowhead-highlight"
                      markerWidth="8"
                      markerHeight="6"
                      refX="8"
                      refY="3"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 8 3, 0 6"
                        fill="currentColor"
                        className="text-orange-400"
                      />
                    </marker>
                  </defs>

                  {edges.map((e, i) => {
                    const from = nodeById.get(e.from);
                    const to = nodeById.get(e.to);
                    if (!from || !to) return null;
                    const highlighted = isEdgeHighlighted(e);
                    const curvature = edgeCurvatures[i] ?? 0;
                    const d = edgePath(from, to, curvature);
                    return (
                      <path
                        key={i}
                        d={d}
                        fill="none"
                        stroke={highlighted ? "#fb923c" : "#3f3f46"}
                        strokeWidth={highlighted ? 2 : 1}
                        markerEnd={
                          highlighted
                            ? "url(#arrowhead-highlight)"
                            : "url(#arrowhead)"
                        }
                      />
                    );
                  })}

                  {nodes.map((node) => {
                    const isHovered = hoveredNode === node.id;
                    const isConnected =
                      hoveredNode !== null &&
                      edges.some(
                        (e) =>
                          (e.from === hoveredNode && e.to === node.id) ||
                          (e.to === hoveredNode && e.from === node.id),
                      );
                    const dimmed =
                      hoveredNode !== null && !isHovered && !isConnected;
                    const label =
                      node.name.length > 22
                        ? `${node.name.slice(0, 20)}...`
                        : node.name;

                    return (
                      <g
                        key={node.id}
                        onMouseEnter={() => setHoveredNode(node.id)}
                        onMouseLeave={() => setHoveredNode(null)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={node.x}
                          y={node.y}
                          width={NODE_W}
                          height={NODE_H}
                          rx={6}
                          fill={isHovered ? "#27272a" : "#18181b"}
                          stroke={
                            isHovered
                              ? "#fb923c"
                              : isConnected
                                ? "#a1a1aa"
                                : "#3f3f46"
                          }
                          strokeWidth={isHovered ? 2 : 1}
                          opacity={dimmed ? 0.3 : 1}
                        />
                        <clipPath id={`node-label-clip-${node.id}`}>
                          <rect
                            x={node.x + 8}
                            y={node.y + 4}
                            width={NODE_W - 16}
                            height={NODE_H - 8}
                          />
                        </clipPath>
                        <a href={`/topic/${node.id}`}>
                          <text
                            x={node.x + NODE_W / 2}
                            y={node.y + NODE_H / 2 + 1}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            clipPath={`url(#node-label-clip-${node.id})`}
                            fill={
                              isHovered
                                ? "#fb923c"
                                : dimmed
                                  ? "#71717a"
                                  : "#d4d4d8"
                            }
                            fontSize={FONT_SIZE}
                          >
                            {label}
                          </text>
                        </a>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
