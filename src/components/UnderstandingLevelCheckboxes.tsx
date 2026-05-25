import type { CSSProperties } from "react";

import {
  LEVEL_INK_COLORS,
  UNDERSTANDING_LEVEL_LABELS,
  UNDERSTANDING_LEVELS,
  getLevelShortLabel,
  type UnderstandingLevel,
  type UnderstandingLevelCounts,
} from "~/shared/understandingLevels";

export function UnderstandingLevelCheckboxes({
  currentLevel,
  onLevelChange,
  isActive,
  counts,
}: {
  currentLevel?: UnderstandingLevel;
  onLevelChange: (level: UnderstandingLevel | undefined) => void;
  isActive?: boolean;
  counts?: UnderstandingLevelCounts;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Level of understanding</legend>
      <div className="grid grid-cols-4 gap-2">
        {UNDERSTANDING_LEVELS.map((level) => {
          const checked = currentLevel === level;
          const label = getLevelShortLabel(level);
          const fullLabel = UNDERSTANDING_LEVEL_LABELS[level];
          const showTooltip = label !== fullLabel;
          // `--lvl` feeds the colour into border / dot / count via Tailwind
          // arbitrary values. Ink shade (lighter for unfamiliar) keeps text
          // and stroke legible against zinc-800/zinc-900 backgrounds.
          const lvlStyle = {
            "--lvl": LEVEL_INK_COLORS[level],
          } as CSSProperties;
          return (
            <label
              key={level}
              style={lvlStyle}
              // `group/lvl` is the per-button hover scope; the outer `group`
              // (topic card) drives the card-hover flare on the selected
              // button when the topic itself isn't the active one.
              className={`group/lvl flex items-center gap-1.5 rounded-lg border px-1 py-1 text-[11px] text-zinc-200 transition ${
                checked
                  ? isActive
                    ? "border-(--lvl)/50 bg-zinc-800"
                    : "border-zinc-700 bg-zinc-800 group-hover:border-(--lvl)/50"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onLevelChange(checked ? undefined : level)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                  checked
                    ? isActive
                      ? "border-(--lvl) bg-(--lvl)/20"
                      : "border-zinc-500 bg-zinc-900 group-hover:border-(--lvl) group-hover:bg-(--lvl)/20"
                    : "border-zinc-500 bg-zinc-900"
                }`}
              >
                {/* Dot is always present so it can fade in on local hover and
                    stay solid when the button is checked, always level-coloured. */}
                <span
                  className={`h-2 w-2 rounded-sm bg-(--lvl) transition-opacity ${
                    checked
                      ? "opacity-100"
                      : "opacity-0 group-hover/lvl:opacity-50"
                  }`}
                />
              </span>
              <span
                className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                title={showTooltip ? fullLabel : undefined}
              >
                {label}
              </span>
              {counts && (
                <span className="ml-auto text-(--lvl) tabular-nums">
                  {counts[level]}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
