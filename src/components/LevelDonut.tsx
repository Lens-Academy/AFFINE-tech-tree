import {
  LEVEL_COLORS,
  UNDERSTANDING_LEVEL_LABELS,
  UNDERSTANDING_LEVELS,
  type UnderstandingLevelCounts,
} from "~/shared/understandingLevels";

/**
 * Annular donut summarising how many people sit at each understanding level
 * on one topic. Drawn directly in SVG (no chart library, matching the rest
 * of the codebase). The hole in the middle is left transparent so the donut
 * can sit on top of any background.
 *
 * Geometry: 0° points up, segments march clockwise. The order
 *   null → unfamiliar → vague → can_teach → advanced_questions_welcome
 * makes "did not respond" (real black) land on the right side and
 * "advanced" (lime) wrap to the left side, regardless of the actual mix.
 */
export function LevelDonut({
  counts,
  totalRespondents,
  size,
  className,
  ariaLabel,
  // When embedded inside a parent <svg>, x/y position the donut in the parent's
  // user-coordinate system (nested-svg semantics). Ignored when standalone.
  x,
  y,
}: {
  counts: UnderstandingLevelCounts;
  totalRespondents: number;
  size: number;
  className?: string;
  ariaLabel?: string;
  x?: number;
  y?: number;
}) {
  if (totalRespondents <= 0 || size <= 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2;
  const innerR = size * 0.32;

  const sum =
    counts.unfamiliar +
    counts.vague +
    counts.can_teach +
    counts.advanced_questions_welcome;
  const nullCount = Math.max(totalRespondents - sum, 0);

  // Clockwise from top: null → unfamiliar → vague → can_teach → advanced.
  const segments: { key: string; color: string; value: number }[] = [
    { key: "null", color: "#000000", value: nullCount },
    ...UNDERSTANDING_LEVELS.map((level) => ({
      key: level,
      color: LEVEL_COLORS[level],
      value: counts[level],
    })),
  ];

  // nullCount + sum >= totalRespondents > 0 here (nullCount tops up any gap).
  const denom = nullCount + sum;

  // Special case: exactly one segment fills the whole circle. A single SVG arc
  // can't draw a closed loop (start == end), so render a full ring instead.
  const onlySegment = segments.find((s) => s.value === denom);

  let acc = 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      x={x}
      y={y}
      className={className}
      role="img"
      aria-label={ariaLabel ?? donutAriaLabel(counts, nullCount, denom)}
    >
      {onlySegment ? (
        <FullRing
          cx={cx}
          cy={cy}
          innerR={innerR}
          outerR={outerR}
          color={onlySegment.color}
        />
      ) : (
        segments.map((seg) => {
          if (seg.value === 0) return null;
          const startFrac = acc / denom;
          acc += seg.value;
          const endFrac = acc / denom;
          return (
            <path
              key={seg.key}
              d={annularSectorPath(cx, cy, innerR, outerR, startFrac, endFrac)}
              fill={seg.color}
            />
          );
        })
      )}
    </svg>
  );
}

function FullRing({
  cx,
  cy,
  innerR,
  outerR,
  color,
}: {
  cx: number;
  cy: number;
  innerR: number;
  outerR: number;
  color: string;
}) {
  // Outer circle filled, inner circle punched out using fill-rule evenodd.
  const d =
    `M ${cx - outerR} ${cy} ` +
    `A ${outerR} ${outerR} 0 1 0 ${cx + outerR} ${cy} ` +
    `A ${outerR} ${outerR} 0 1 0 ${cx - outerR} ${cy} Z ` +
    `M ${cx - innerR} ${cy} ` +
    `A ${innerR} ${innerR} 0 1 0 ${cx + innerR} ${cy} ` +
    `A ${innerR} ${innerR} 0 1 0 ${cx - innerR} ${cy} Z`;
  return <path d={d} fill={color} fillRule="evenodd" />;
}

/**
 * Build an SVG path for an annular sector. `startFrac` and `endFrac` are in
 * [0, 1] where 0 means "top of the circle" and the sweep is clockwise.
 */
function annularSectorPath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startFrac: number,
  endFrac: number,
): string {
  const tau = Math.PI * 2;
  // -π/2 puts the 0-fraction mark at 12 o'clock; with SVG's y-down, increasing
  // the angle then sweeps clockwise, which is what we want.
  const a0 = -Math.PI / 2 + startFrac * tau;
  const a1 = -Math.PI / 2 + endFrac * tau;
  const largeArc = endFrac - startFrac > 0.5 ? 1 : 0;

  const x0o = cx + outerR * Math.cos(a0);
  const y0o = cy + outerR * Math.sin(a0);
  const x1o = cx + outerR * Math.cos(a1);
  const y1o = cy + outerR * Math.sin(a1);
  const x0i = cx + innerR * Math.cos(a0);
  const y0i = cy + innerR * Math.sin(a0);
  const x1i = cx + innerR * Math.cos(a1);
  const y1i = cy + innerR * Math.sin(a1);

  return [
    `M ${x0o} ${y0o}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x0i} ${y0i}`,
    "Z",
  ].join(" ");
}

function donutAriaLabel(
  counts: UnderstandingLevelCounts,
  nullCount: number,
  denom: number,
): string {
  const parts: string[] = [];
  if (nullCount > 0) parts.push(`${nullCount} no status`);
  for (const level of UNDERSTANDING_LEVELS) {
    if (counts[level] > 0) {
      parts.push(`${counts[level]} ${UNDERSTANDING_LEVEL_LABELS[level]}`);
    }
  }
  return `${denom} respondents: ${parts.join(", ")}`;
}
