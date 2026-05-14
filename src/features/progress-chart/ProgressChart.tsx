import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleTime } from "d3";

import { LevelDot } from "~/components/LevelDot";
import { TopicAffordanceIcon } from "~/components/TopicAffordanceIcon";
import {
  LEVEL_COLORS,
  UNDERSTANDING_LEVELS,
  UNDERSTANDING_LEVEL_LABELS,
  getLevelShortLabel,
  type UnderstandingLevel,
  sumUnderstandingLevelCounts,
} from "~/shared/understandingLevels";
import { type RouterOutputs } from "~/utils/api";

type ProgressDay = RouterOutputs["progress"]["overTime"]["days"][number];
type BarDatum = {
  date: string;
  cx: number; // center x in SVG inner coords
  segments: Array<{ y: number; height: number; fill: string }>;
};
type ChartLayout = {
  containerWidth: number;
  svgLeft: number;
  svgWidth: number;
};

const WIDTH = 880;
const HEIGHT = 340;
const MARGIN = { top: 16, right: 24, bottom: 40, left: 44 };

// Stable foundation at the bottom, achievement at the top.
const STACK_ORDER: readonly UnderstandingLevel[] = [
  "unfamiliar",
  "vague",
  "can_teach",
  "advanced_questions_welcome",
];

const DAY_MS = 24 * 60 * 60 * 1000;

function toUtcHhMm(d: Date): string {
  return d.toISOString().slice(11, 16);
}

function utcDayStart(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function formatBarLabel(isoDay: string): string {
  return utcDayStart(isoDay).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ProgressChart({
  days,
}: {
  days: RouterOutputs["progress"]["overTime"]["days"];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [pinnedKey, setPinnedKey] = useState<string | null>(null);
  const [layout, setLayout] = useState<ChartLayout>({
    containerWidth: 0,
    svgLeft: 0,
    svgWidth: 0,
  });

  const innerW = WIDTH - MARGIN.left - MARGIN.right;
  const innerH = HEIGHT - MARGIN.top - MARGIN.bottom;

  useEffect(() => {
    const updateLayout = () => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!containerRect || !svgRect) return;
      setLayout((current) => {
        const next = {
          containerWidth: containerRect.width,
          svgLeft: svgRect.left - containerRect.left,
          svgWidth: svgRect.width,
        };
        if (
          current.containerWidth === next.containerWidth &&
          current.svgLeft === next.svgLeft &&
          current.svgWidth === next.svgWidth
        ) {
          return current;
        }
        return next;
      });
    };

    updateLayout();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateLayout);
      return () => window.removeEventListener("resize", updateLayout);
    }

    const resizeObserver = new ResizeObserver(updateLayout);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    if (svgRef.current) resizeObserver.observe(svgRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  const { yTicks, bars, barWidth, daysByKey, labelEvery } = useMemo(() => {
    if (days.length === 0) {
      return {
        yTicks: [] as Array<{ y: number; label: string }>,
        bars: [] as BarDatum[],
        barWidth: 0,
        daysByKey: new Map<string, ProgressDay>(),
        labelEvery: 1,
      };
    }

    // ── Domain: half-day padding each side so bars aren't flush to edges ──────
    const firstMidnight = utcDayStart(days[0]!.date);
    const lastMidnight = utcDayStart(days[days.length - 1]!.date);
    const domainStart = new Date(firstMidnight.getTime() - DAY_MS / 2);
    const domainEnd = new Date(lastMidnight.getTime() + DAY_MS * 1.5);

    // ── Scales ────────────────────────────────────────────────────────────────
    const x = scaleTime().domain([domainStart, domainEnd]).range([0, innerW]);

    // Width of one day slot in pixels, used to size the bars.
    const daySlotPx =
      (innerW / (domainEnd.getTime() - domainStart.getTime())) * DAY_MS;
    const barWidth = Math.min(48, Math.max(6, daySlotPx * 0.65));

    const maxCount = Math.max(
      1,
      ...days.map((d) => sumUnderstandingLevelCounts(d.counts)),
    );
    const y = scaleLinear().domain([0, maxCount]).nice(5).range([innerH, 0]);

    // ── Bars ──────────────────────────────────────────────────────────────────
    // Each bar shows one day's end-of-day counts (the authoritative backend
    // snapshot). No forward/backward reconstruction needed here.
    const bars: BarDatum[] = days.map((day) => {
      const cx = x(new Date(utcDayStart(day.date).getTime() + DAY_MS / 2));
      const segments: BarDatum["segments"] = [];
      let baseline = 0;
      for (const level of STACK_ORDER) {
        const count = day.counts[level];
        if (count <= 0) continue;
        segments.push({
          y: y(baseline + count),
          height: y(baseline) - y(baseline + count),
          fill: LEVEL_COLORS[level],
        });
        baseline += count;
      }
      return { date: day.date, cx, segments };
    });

    // ── Axis ticks ────────────────────────────────────────────────────────────
    const yTicks = y.ticks(5).map((v) => ({ y: y(v), label: String(v) }));

    // Show at most ~15 date labels to avoid crowding.
    const labelEvery = Math.max(1, Math.ceil(days.length / 15));

    const daysByKey = new Map<string, ProgressDay>();
    for (const d of days) daysByKey.set(d.date, d);

    return { yTicks, bars, barWidth, daysByKey, labelEvery };
  }, [days, innerW, innerH]);

  // Snap mouse position to the nearest bar's date.
  function getDayKey(clientX: number): string | null {
    if (bars.length === 0) return null;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const relX = ((clientX - rect.left) / rect.width) * WIDTH - MARGIN.left;
    let nearest = bars[0]!;
    let minDist = Math.abs(nearest.cx - relX);
    for (const bar of bars) {
      const dist = Math.abs(bar.cx - relX);
      if (dist < minDist) {
        minDist = dist;
        nearest = bar;
      }
    }
    return nearest.date;
  }

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    if (pinnedKey) return;
    const nextKey = getDayKey(e.clientX);
    if (!nextKey) return;
    setHoverKey(nextKey);
  }

  function onClick(e: React.MouseEvent<SVGRectElement>) {
    const nextKey = getDayKey(e.clientX);
    if (!nextKey) return;
    setPinnedKey((current) => (current === nextKey ? null : nextKey));
    setHoverKey(nextKey);
  }

  if (days.length === 0) {
    return (
      <p className="text-zinc-500">
        No progress yet — set a level on some topics to start your chart.
      </p>
    );
  }

  const activeKey = pinnedKey ?? hoverKey;
  const hoveredDay = activeKey ? daysByKey.get(activeKey) : null;

  // Position tooltip relative to the hovered bar's screen coords.
  const svgScale = layout.svgWidth > 0 ? layout.svgWidth / WIDTH : 0;
  let tooltipVisible = false;
  let tooltipLeftPx = 0;
  let tooltipRightPx = 0;
  if (activeKey) {
    const activeBar = bars.find((b) => b.date === activeKey);
    if (activeBar) {
      tooltipLeftPx =
        layout.svgLeft + (MARGIN.left + activeBar.cx - barWidth / 2) * svgScale;
      tooltipRightPx =
        layout.svgLeft + (MARGIN.left + activeBar.cx + barWidth / 2) * svgScale;
      tooltipVisible = true;
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseLeave={() => {
        if (!pinnedKey) setHoverKey(null);
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label="Cumulative understanding levels over time"
      >
        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {/* Y-axis gridlines and labels */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={0}
                x2={innerW}
                y1={t.y}
                y2={t.y}
                stroke="#27272a"
                strokeDasharray="2 3"
              />
              <text
                x={-8}
                y={t.y}
                dy="0.32em"
                textAnchor="end"
                fill="#71717a"
                fontSize={11}
              >
                {t.label}
              </text>
            </g>
          ))}

          {/* One stacked bar per day */}
          {bars.map((bar, barIndex) => {
            const isActive = bar.date === activeKey;
            const showLabel =
              barIndex % labelEvery === 0 || barIndex === bars.length - 1;
            return (
              <g key={bar.date}>
                {bar.segments.map((seg, i) => (
                  <rect
                    key={i}
                    x={bar.cx - barWidth / 2}
                    y={seg.y}
                    width={barWidth}
                    height={seg.height}
                    fill={seg.fill}
                    opacity={isActive ? 0.65 : 1}
                    shapeRendering="crispEdges"
                  />
                ))}
                {showLabel && (
                  <text
                    x={bar.cx}
                    y={innerH + 16}
                    textAnchor="middle"
                    fill={isActive ? "#d4d4d8" : "#52525b"}
                    fontSize={10}
                  >
                    {formatBarLabel(bar.date)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Invisible overlay that catches mouse events */}
          <rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={onMove}
            onClick={onClick}
          />
        </g>
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
        {UNDERSTANDING_LEVELS.map((l) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: LEVEL_COLORS[l] }}
            />
            {UNDERSTANDING_LEVEL_LABELS[l]}
          </span>
        ))}
      </div>

      {hoveredDay && tooltipVisible && (
        <DayTooltip
          day={hoveredDay}
          bandLeftPx={tooltipLeftPx}
          bandRightPx={tooltipRightPx}
          containerWidth={layout.containerWidth}
        />
      )}
    </div>
  );
}

function DayTooltip({
  day,
  bandLeftPx,
  bandRightPx,
  containerWidth,
}: {
  day: ProgressDay;
  bandLeftPx: number;
  bandRightPx: number;
  containerWidth: number;
}) {
  // Flip to the opposite side when the band sits in the right half.
  const anchorRight =
    containerWidth > 0 && (bandLeftPx + bandRightPx) / 2 > containerWidth / 2;
  const style: React.CSSProperties = anchorRight
    ? { right: containerWidth - bandLeftPx + 8 }
    : { left: bandRightPx + 8 };

  return (
    <div
      className="absolute top-2 max-w-sm rounded-md border border-zinc-700 bg-zinc-900/95 p-3 text-xs shadow-lg"
      style={style}
    >
      <div className="mb-1.5 font-medium text-zinc-200">
        {day.date}
        <span className="pl-1 text-zinc-600">Changes in UTC time</span>
      </div>

      <div className="mb-2 ml-auto grid w-fit grid-cols-[auto_max-content] gap-x-2 gap-y-0.5">
        {UNDERSTANDING_LEVELS.map((l) => (
          <TotalRow key={l} level={l} count={day.counts[l]} />
        ))}
      </div>

      {day.changes.length > 0 ? (
        <ul className="space-y-0.5">
          {day.changes.map((c, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="inline-flex h-4 shrink-0 items-center gap-0.5 text-zinc-500">
                <LevelDot
                  level={c.from}
                  label={`From ${c.from ? getLevelShortLabel(c.from) : "none"}`}
                />
                <span aria-hidden className="text-[10px] text-zinc-600">
                  ➜
                </span>
                <LevelDot
                  level={c.to}
                  label={`To ${c.to ? getLevelShortLabel(c.to) : "none"}`}
                />
              </span>
              <span className="shrink-0 text-zinc-600 tabular-nums">
                {toUtcHhMm(new Date(c.at))}
              </span>
              <span className="min-w-0 flex-1 text-zinc-100">
                {c.topicName}
              </span>
              <span className="ml-auto flex shrink-0 items-start">
                {c.isExcited ? (
                  <TopicAffordanceIcon
                    variant="read-only"
                    kind="star"
                    filled
                    title="Excited to teach"
                    className="mr-1 inline-flex [&>svg]:h-4 [&>svg]:w-4"
                  />
                ) : null}
                <TopicAffordanceIcon
                  variant="read-only"
                  kind="bookmark"
                  filled={c.isBookmarked}
                  title={c.isBookmarked ? "Bookmarked" : "Not bookmarked"}
                  className="inline-flex [&>svg]:h-4 [&>svg]:w-4"
                />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-zinc-500">No changes this day.</div>
      )}
    </div>
  );
}

function TotalRow({
  level,
  count,
}: {
  level: UnderstandingLevel;
  count: number;
}) {
  return (
    <>
      <span className="flex items-center gap-1.5 text-zinc-400">
        <span
          className="inline-block h-2.5 w-2.5 rounded-sm"
          style={{ background: LEVEL_COLORS[level] }}
        />
        {getLevelShortLabel(level)}
      </span>
      <span className="justify-self-end pr-1 text-right text-zinc-200 tabular-nums">
        {count}
      </span>
    </>
  );
}
