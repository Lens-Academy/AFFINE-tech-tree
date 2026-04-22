import {
  LEVEL_COLORS,
  type UnderstandingLevel,
} from "~/shared/understandingLevels";

/**
 * A small colored square representing an understanding level, matching the
 * progress chart's legend/tooltip palette. `null` level renders as a dashed
 * placeholder for "no level set".
 *
 * Pass `title` when the dot is reachable by mouse and should surface a native
 * tooltip; skip it inside constructs that are themselves only visible on
 * hover/focus (e.g. chart tooltips).
 */
export function LevelDot({
  level,
  label,
  title,
  className = "h-2 w-2",
}: {
  level: UnderstandingLevel | null;
  label: string;
  title?: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={title}
      className={`inline-block shrink-0 rounded-sm ${className}`}
      style={{
        background: level ? LEVEL_COLORS[level] : "transparent",
        border: level ? "none" : "1px dashed #71717a",
      }}
    />
  );
}
