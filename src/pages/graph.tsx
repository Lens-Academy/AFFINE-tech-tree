import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageShell } from "~/components/PageShell";
import { FloatingTopicPreview } from "~/features/topic-detail/FloatingTopicPreview";
import { computePaneWidth } from "~/features/topic-detail/paneLayout";
import {
  assignManualPositions,
  edgePath,
  NODE_H,
  NODE_W,
  PAD,
  type Edge,
  type GraphTopic,
  type PositionedNode,
} from "~/features/prerequisite-graph/layout";
import { api } from "~/utils/api";

const NODE_STYLES = {
  idle: {
    fill: "#18181b", // zinc-900
    stroke: "#3f3f46", // zinc-700
    text: "#d4d4d8", // zinc-300
    strokeWidth: 1,
  },
  hovered: {
    fill: "#27272a", // zinc-800
    stroke: "#fb923c", // orange-400
    text: "#fdba74", // orange-300 (lighter than border)
    strokeWidth: 2,
  },
  selected: {
    fill: "#27272a", // zinc-800
    stroke: "#f97316", // orange-500 - matches active TopicCard border
    text: "#fdba74", // orange-300 (lighter than border)
    strokeWidth: 2.5,
  },
} as const;

const EDGE_IDLE = "#3f3f46"; // zinc-700
const EDGE_HOVERED = "#fb923c"; // orange-400
const EDGE_SELECTED = "#f97316"; // orange-500

type NodeState = keyof typeof NODE_STYLES;

export function PrerequisiteGraphView({
  topics,
  edges,
  activeNodeId,
  onSelectNode,
}: {
  topics: GraphTopic[];
  edges: Edge[];
  activeNodeId: number | null;
  onSelectNode: (id: number) => void;
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

  // Each edge gets a tier based on its relation to selection/hover.
  // Selection wins over hover so hovering something unrelated doesn't dim the active edges.
  const edgeTiers = useMemo(() => {
    const result = {
      idle: [] as Edge[],
      hovered: [] as Edge[],
      selected: [] as Edge[],
    };
    for (const e of edges) {
      const touchesSelected =
        activeNodeId !== null &&
        (e.from === activeNodeId || e.to === activeNodeId);
      const touchesHovered =
        hoveredNode !== null &&
        (e.from === hoveredNode || e.to === hoveredNode);
      if (touchesSelected) result.selected.push(e);
      else if (touchesHovered) result.hovered.push(e);
      else result.idle.push(e);
    }
    return result;
  }, [edges, activeNodeId, hoveredNode]);

  return (
    <svg width={size.w} height={size.h}>
      <defs>
        <ArrowMarker id="arrow-idle" color={EDGE_IDLE} />
        <ArrowMarker id="arrow-hovered" color={EDGE_HOVERED} />
        <ArrowMarker id="arrow-selected" color={EDGE_SELECTED} />
      </defs>

      {/* Idle edges below nodes so the arrow tips tuck behind the node boxes (clean base look). */}
      <EdgeGroup
        edges={edgeTiers.idle}
        nodeById={nodeById}
        color={EDGE_IDLE}
        strokeWidth={1}
        marker="arrow-idle"
      />

      {nodes.map((node) => {
        const isSelected = activeNodeId === node.id;
        const isHovered = hoveredNode === node.id;
        const state: NodeState = isSelected
          ? "selected"
          : isHovered
            ? "hovered"
            : "idle";
        const style = NODE_STYLES[state];
        const label =
          node.name.length > 22 ? `${node.name.slice(0, 20)}...` : node.name;
        return (
          <g
            key={node.id}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
            onClick={() => onSelectNode(node.id)}
            className="cursor-pointer"
            role="button"
            aria-pressed={isSelected}
            aria-label={`Open preview for ${node.name}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key !== "Enter" && e.key !== " ") return;
              e.preventDefault();
              onSelectNode(node.id);
            }}
          >
            <rect
              x={node.x}
              y={node.y}
              width={NODE_W}
              height={NODE_H}
              rx={6}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
            />
            <text
              x={node.x + NODE_W / 2}
              y={node.y + NODE_H / 2 + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={style.text}
              fontSize={14}
              pointerEvents="none"
            >
              {label}
            </text>
          </g>
        );
      })}

      {/* Highlighted edges on top of nodes so their arrowheads are fully visible
          and hover/selected highlight sets combine cleanly when both exist. */}
      <EdgeGroup
        edges={edgeTiers.hovered}
        nodeById={nodeById}
        color={EDGE_HOVERED}
        strokeWidth={1.5}
        marker="arrow-hovered"
      />
      <EdgeGroup
        edges={edgeTiers.selected}
        nodeById={nodeById}
        color={EDGE_SELECTED}
        strokeWidth={1.75}
        marker="arrow-selected"
      />
    </svg>
  );
}

function ArrowMarker({ id, color }: { id: string; color: string }) {
  return (
    <marker
      id={id}
      markerWidth="8"
      markerHeight="6"
      refX="8"
      refY="3"
      orient="auto"
    >
      <polygon points="0 0, 8 3, 0 6" fill={color} />
    </marker>
  );
}

function EdgeGroup({
  edges,
  nodeById,
  color,
  strokeWidth,
  marker,
}: {
  edges: Edge[];
  nodeById: Map<number, PositionedNode>;
  color: string;
  strokeWidth: number;
  marker: string;
}) {
  return (
    <>
      {edges.map((e, i) => {
        const from = nodeById.get(e.from);
        const to = nodeById.get(e.to);
        if (!from || !to) return null;
        return (
          <path
            key={`${e.from}-${e.to}-${i}`}
            d={edgePath(from, to)}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            markerEnd={`url(#${marker})`}
            pointerEvents="none"
          />
        );
      })}
    </>
  );
}

export default function PrerequisiteGraphPage() {
  const { data: graph, isLoading } = api.topic.prerequisiteGraph.useQuery();
  const router = useRouter();
  const selectedTopicId = parseTopicParam(router.query.topic);
  const graphSectionRef = useRef<HTMLDivElement>(null);
  // Track whether the page has rendered at least once, so we only animate the preview
  // when a user actively selects a node (vs. a deep-link / reload opening it immediately).
  const hasMountedRef = useRef(false);
  const animatePreview = hasMountedRef.current;
  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  const setSelectedTopicId = useCallback(
    (id: number | null) => {
      const rest = Object.fromEntries(
        Object.entries(router.query).filter(([key]) => key !== "topic"),
      );
      const query = id !== null ? { ...rest, topic: String(id) } : rest;
      void router.push({ pathname: router.pathname, query }, undefined, {
        shallow: true,
        scroll: false,
      });
    },
    [router],
  );

  // On selection, horizontally scroll so the node's right edge sits just left of the preview.
  // Skip on mobile where the pane covers the whole graph anyway.
  useEffect(() => {
    if (selectedTopicId === null || !graph) return;
    const container = graphSectionRef.current;
    if (!container) return;
    const node = assignManualPositions(graph.nodes, graph.edges).find(
      (n) => n.id === selectedTopicId,
    );
    if (!node) return;
    const paneWidth = computePaneWidth(
      window.innerWidth,
      container.clientWidth,
    );
    const visibleRight = container.clientWidth - paneWidth;
    if (visibleRight <= 0) return;
    const gap = 16;
    const targetLeft = node.x + NODE_W - visibleRight + gap;
    if (targetLeft <= container.scrollLeft) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    container.scrollTo({
      left: targetLeft,
      behavior: reducedMotion ? "auto" : "smooth",
    });
  }, [selectedTopicId, graph]);

  return (
    <>
      <Head>
        <title>Graph | AFFINE Tech Tree</title>
      </Head>
      <PageShell mainClassName="max-w-none">
        <div
          ref={graphSectionRef}
          // When the preview is open on tablet+, reserve space on the right so the SVG can be
          // scrolled out from under the sticky pane. Value must stay in sync with
          // `computePaneWidth` in `~/features/topic-detail/paneLayout.ts`. Mobile (<md)
          // just shows the preview over everything.
          className={`overflow-auto rounded-lg border border-zinc-800 bg-zinc-900 p-4 pb-0 ${
            selectedTopicId !== null ? "md:pr-[min(60vw,560px)]" : ""
          }`}
        >
          {isLoading && <p className="text-zinc-500">Loading graph...</p>}
          {graph && graph.nodes.length > 0 && (
            <PrerequisiteGraphView
              topics={graph.nodes}
              edges={graph.edges}
              activeNodeId={selectedTopicId}
              onSelectNode={(id) =>
                setSelectedTopicId(selectedTopicId === id ? null : id)
              }
            />
          )}
        </div>
        {selectedTopicId !== null && (
          <FloatingTopicPreview
            topicId={selectedTopicId}
            onClose={() => setSelectedTopicId(null)}
            onSelectTopic={(id) => setSelectedTopicId(id)}
            anchorRef={graphSectionRef}
            animateIn={animatePreview}
          />
        )}
      </PageShell>
    </>
  );
}

function parseTopicParam(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
