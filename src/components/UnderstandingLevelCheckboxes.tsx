import {
  UNDERSTANDING_LEVEL_LABELS,
  UNDERSTANDING_LEVELS,
  type UnderstandingLevel,
} from "~/shared/understandingLevels";

export function UnderstandingLevelCheckboxes({
  currentLevel,
  onLevelChange,
}: {
  currentLevel?: UnderstandingLevel;
  onLevelChange: (level: UnderstandingLevel | undefined) => void;
}) {
  return (
    <fieldset>
      <legend className="sr-only">Level of understanding</legend>
      <div className="grid grid-cols-4 gap-2">
        {UNDERSTANDING_LEVELS.map((level) => {
          const checked = currentLevel === level;
          const fullLabel = UNDERSTANDING_LEVEL_LABELS[level];
          const label =
            level === "advanced_questions_welcome" ? "Advanced" : fullLabel;
          const showTooltip = label !== fullLabel;
          return (
            <label
              key={level}
              className={`flex items-center gap-1.5 rounded-lg border px-1 py-1 transition ${
                checked
                  ? "border-orange-500/50 bg-orange-500/10 text-orange-300"
                  : "border-zinc-700 bg-zinc-800 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-700"
              } text-[11px]`}
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
                    ? "border-orange-500 bg-orange-500/20"
                    : "border-zinc-500 bg-zinc-900"
                }`}
              >
                {checked && (
                  <span className="h-2 w-2 rounded-sm bg-orange-300" />
                )}
              </span>
              <span
                className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
                title={showTooltip ? fullLabel : undefined}
              >
                {label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
