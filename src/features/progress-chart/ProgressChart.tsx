import { useEffect, useMemo, useRef, useState } from "react";
import { scaleLinear, scaleTime } from "d3";

import { BookmarkIcon } from "~/components/BookmarkIcon";
import { StarIcon } from "~/components/StarIcon";
import {
  LEVEL_COLORS,
  UNDERSTANDING_LEVELS,
  UNDERSTANDING_LEVEL_LABELS,
  getLevelShortLabel,
  type UnderstandingLevel,
  emptyUnderstandingLevelCounts,
  sumUnderstandingLevelCounts,
} from "~/shared/understandingLevels";
import { type RouterOutputs } from "~/utils/api";

type ProgressDay = RouterOutputs["progress"]["overTime"]["days"][number];
type ProgressChange = ProgressDay["changes"][number];
type Point = { at: Date; counts: ProgressDay["counts"] };
type RectSegment = {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
};
type ChartLayout = {
  containerWidth: number;
  svgLeft: number;
  svgWidth: number;
};

const WIDTH = 880;
const HEIGHT = 340;
const MARGIN = { top: 16, right: 24, bottom: 28, left: 44 };

// Stable foundation at the bottom, achievement at the top.
const STACK_ORDER: readonly UnderstandingLevel[] = [
  "unfamiliar",
  "vague",
  "can_teach",
  "advanced_questions_welcome",
];

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_LOOKAHEAD_MS = 6 * 60 * 60 * 1000;

function toIsoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toUtcHhMm(d: Date): string {
  return d.toISOString().slice(11, 16);
}

function utcDayStart(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
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

  const {
    xScale,
    xTicks,
    yTicks,
    rectSegments,
    daysByKey,
    domainStart,
    domainEnd,
  } = useMemo(() => {
    if (days.length === 0) {
      return {
        xScale: null,
        xTicks: [] as Array<{ x: number; label: string }>,
        yTicks: [] as Array<{ y: number; label: string }>,
        rectSegments: [] as RectSegment[],
        daysByKey: new Map<string, ProgressDay>(),
        domainStart: new Date(),
        domainEnd: new Date(),
      };
    }

    const start = utcDayStart(days[0]!.date);
    const now = new Date();
    const todayEnd = new Date(utcDayStart(toIsoDay(now)).getTime() + DAY_MS);
    const latestChangeAt = new Date(
      days[days.length - 1]!.changes[days[days.length - 1]!.changes.length - 1]!
        .at,
    );
    const changes = days.flatMap((day) => day.changes);
    const end = new Date(
      Math.max(
        todayEnd.getTime(),
        now.getTime() + LIVE_LOOKAHEAD_MS,
        latestChangeAt.getTime() + LIVE_LOOKAHEAD_MS,
      ),
    );

    const points: Point[] = [];
    const counts = emptyUnderstandingLevelCounts();
    points.push({ at: start, counts: { ...counts } });

    const changeGroups: Array<{ at: Date; changes: ProgressChange[] }> = [];
    for (const change of changes) {
      const at = new Date(change.at);
      const lastGroup = changeGroups[changeGroups.length - 1];
      if (lastGroup?.at.getTime() === at.getTime()) {
        lastGroup.changes.push(change);
      } else {
        changeGroups.push({ at, changes: [change] });
      }
    }

    for (const group of changeGroups) {
      for (const change of group.changes) {
        if (change.from) counts[change.from]--;
        if (change.to) counts[change.to]++;
      }
      points.push({ at: group.at, counts: { ...counts } });
    }

    points.push({ at: end, counts: { ...counts } });

    const maxStack = Math.max(
      1,
      ...points.map((point) => sumUnderstandingLevelCounts(point.counts)),
    );

    const x = scaleTime().domain([start, end]).range([0, innerW]);
    const y = scaleLinear().domain([0, maxStack]).nice(5).range([innerH, 0]);
    const rects: RectSegment[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      const point = points[i]!;
      const nextPoint = points[i + 1]!;
      const x0 = x(point.at);
      const x1 = x(nextPoint.at);
      const width = Math.max(0, x1 - x0);
      let baseline = 0;

      for (const level of STACK_ORDER) {
        const count = point.counts[level];
        if (count <= 0) continue;
        const top = baseline + count;
        rects.push({
          x: x0,
          y: y(top),
          width,
          height: y(baseline) - y(top),
          fill: LEVEL_COLORS[level],
        });
        baseline = top;
      }
    }

    const xt = x.ticks(8).map((d) => ({
      x: x(d),
      label: d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    }));
    const yt = y.ticks(5).map((v) => ({ y: y(v), label: String(v) }));

    const map = new Map<string, ProgressDay>();
    for (const d of days) map.set(d.date, d);

    return {
      xScale: x,
      xTicks: xt,
      yTicks: yt,
      rectSegments: rects,
      daysByKey: map,
      domainStart: start,
      domainEnd: end,
    };
  }, [days, innerW, innerH]);

  function getDayKey(clientX: number): string | null {
    if (!xScale) return null;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const relX = ((clientX - rect.left) / rect.width) * WIDTH - MARGIN.left;
    const date = xScale.invert(relX);
    return toIsoDay(date);
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

  // Band spans the full UTC day, clipped to the visible domain.
  let bandX0 = 0;
  let bandX1 = 0;
  let bandVisible = false;
  if (activeKey && xScale) {
    const dayStart = utcDayStart(activeKey);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);
    const clampedStart = dayStart < domainStart ? domainStart : dayStart;
    const clampedEnd = dayEnd > domainEnd ? domainEnd : dayEnd;
    bandX0 = xScale(clampedStart);
    bandX1 = xScale(clampedEnd);
    bandVisible = bandX1 > bandX0;
  }

  const svgScale = layout.svgWidth > 0 ? layout.svgWidth / WIDTH : 0;
  const bandLeftPx = layout.svgLeft + (MARGIN.left + bandX0) * svgScale;
  const bandRightPx = layout.svgLeft + (MARGIN.left + bandX1) * svgScale;

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

          {bandVisible && (
            <rect
              x={bandX0}
              y={0}
              width={bandX1 - bandX0}
              height={innerH}
              fill="#f4f4f5"
              fillOpacity={0.06}
              pointerEvents="none"
            />
          )}

          {rectSegments.map((rect, i) => (
            <rect
              key={i}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={rect.fill}
              shapeRendering="crispEdges"
            />
          ))}

          {bandVisible && (
            <rect
              x={bandX0}
              y={0}
              width={bandX1 - bandX0}
              height={innerH}
              fill="none"
              stroke="#f4f4f5"
              strokeOpacity={0.25}
              strokeWidth={1}
              pointerEvents="none"
            />
          )}

          {xTicks.map((t, i) => (
            <text
              key={i}
              x={t.x}
              y={innerH + 18}
              textAnchor="middle"
              fill="#71717a"
              fontSize={11}
            >
              {t.label}
            </text>
          ))}

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

      {hoveredDay && bandVisible && (
        <DayTooltip
          day={hoveredDay}
          bandLeftPx={bandLeftPx}
          bandRightPx={bandRightPx}
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
                  <span className="mr-1 inline-flex text-zinc-600 [&>svg]:h-4 [&>svg]:w-4">
                    <StarIcon filled />
                  </span>
                ) : null}
                <span
                  className="inline-flex text-zinc-600 [&>svg]:h-4 [&>svg]:w-4"
                  title="Bookmarked"
                >
                  <BookmarkIcon filled={c.isBookmarked} />
                </span>
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

function LevelDot({
  level,
  label,
}: {
  level: UnderstandingLevel | null;
  label: string;
}) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-sm"
      style={{
        background: level ? LEVEL_COLORS[level] : "transparent",
        border: level ? "none" : "1px dashed #71717a",
      }}
      role="img"
      aria-label={label}
    />
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
