import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AuthHeader } from "~/components/AuthHeader";
import {
  assignManualPositions,
  edgePath,
  NODE_H,
  NODE_W,
  PAD,
  type Edge,
  type GraphTopic,
} from "~/features/prerequisite-graph/layout";
import { api } from "~/utils/api";

export function PrerequisiteGraphView({
  topics,
  edges,
}: {
  topics: GraphTopic[];
  edges: Edge[];
}) {
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);

  const nodes = useMemo(
    () => assignManualPositions(topics, edges),
    [topics, edges],
  );
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const size = useMemo(() => {
    if (nodes.length === 0) return { w: 800, h: 600 };
    const w = Math.max(...nodes.map((n) => n.x)) + NODE_W + PAD;
    const h = Math.max(...nodes.map((n) => n.y)) + NODE_H + PAD;
    return { w, h };
  }, [nodes]);

  return (
    <svg width={size.w} height={size.h}>
      <defs>
        <marker
          id="arrow"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#3f3f46" />
        </marker>
        <marker
          id="arrow-hl"
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
        >
          <polygon points="0 0, 8 3, 0 6" fill="#fb923c" />
        </marker>
      </defs>
      {edges
        .map((e, i) => ({ e, i }))
        .filter(({ e }) => {
          if (hoveredNode === null) return true;
          return e.from !== hoveredNode && e.to !== hoveredNode;
        })
        .map(({ e, i }) => {
          const from = nodeById.get(e.from);
          const to = nodeById.get(e.to);
          if (!from || !to) return null;
          return (
            <path
              key={i}
              d={edgePath(from, to)}
              fill="none"
              stroke="#3f3f46"
              strokeWidth={1}
              markerEnd="url(#arrow)"
              pointerEvents="none"
            />
          );
        })}
      {nodes.map((node) => {
        const isHovered = hoveredNode === node.id;
        const label =
          node.name.length > 22 ? `${node.name.slice(0, 20)}...` : node.name;
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
              stroke={isHovered ? "#fb923c" : "#3f3f46"}
              strokeWidth={isHovered ? 2 : 1}
            />
            <a href={`/topic/${node.id}`}>
              <text
                x={node.x + NODE_W / 2}
                y={node.y + NODE_H / 2 + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isHovered ? "#fb923c" : "#d4d4d8"}
                fontSize={14}
              >
                {label}
              </text>
            </a>
          </g>
        );
      })}
      {hoveredNode !== null &&
        edges
          .map((e, i) => ({ e, i }))
          .filter(({ e }) => e.from === hoveredNode || e.to === hoveredNode)
          .map(({ e, i }) => {
            const from = nodeById.get(e.from);
            const to = nodeById.get(e.to);
            if (!from || !to) return null;
            return (
              <path
                key={i}
                d={edgePath(from, to)}
                fill="none"
                stroke="#fb923c"
                strokeWidth={1.5}
                markerEnd="url(#arrow-hl)"
                pointerEvents="none"
              />
            );
          })}
    </svg>
  );
}

export default function PrerequisiteGraphPage() {
  const { data: graph, isLoading } = api.topic.prerequisiteGraph.useQuery();

  return (
    <>
      <Head>
        <title>Graph | AFFINE Tech Tree</title>
      </Head>
      <main className="flex h-screen flex-col bg-zinc-950">
        <header className="shrink-0 border-b border-zinc-800/80 px-4 py-3 md:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="text-sm text-zinc-500 hover:text-zinc-300"
              >
                ← Back to topics
              </Link>
              <span className="text-zinc-700">/</span>
              <span className="text-sm text-zinc-300">Graph</span>
            </div>
            <AuthHeader />
          </div>
        </header>
        <div className="px-4 pt-4 md:px-8">
          {isLoading && <p className="text-zinc-500">Loading graph...</p>}
          {graph && graph.nodes.length > 0 && (
            <PrerequisiteGraphView topics={graph.nodes} edges={graph.edges} />
          )}
        </div>
      </main>
    </>
  );
}
