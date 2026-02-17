import Link from "next/link";
import { useEffect, useState } from "react";

import {
  UNDERSTANDING_LEVEL_LABELS,
  UNDERSTANDING_LEVELS,
  type UnderstandingLevel,
} from "~/shared/understandingLevels";
import { type RouterOutputs } from "~/utils/api";

type Topic = RouterOutputs["topic"]["list"][number];

export function TopicCard({
  topic,
  currentLevel,
  onLevelChange,
  canEdit,
}: {
  topic: Topic;
  currentLevel?: UnderstandingLevel;
  onLevelChange: (level: UnderstandingLevel | undefined) => void;
  canEdit: boolean;
}) {
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (!showDropdown) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowDropdown(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showDropdown]);

  const displayLevel = currentLevel
    ? UNDERSTANDING_LEVEL_LABELS[currentLevel]
    : "—";

  return (
    <li className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <Link href={`/topic/${topic.id}`} className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold bg-linear-60 from-orange-400 to-1% to-zinc-100 group-hover:to-100% bg-clip-text text-transparent">
            {topic.name}
          </h2>
          {topic.description && (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
              {topic.description}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {topic.topicTags.map((tt) => (
              <span
                key={tt.tag.name}
                className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
              >
                {tt.tag.name}
              </span>
            ))}
          </div>
        </Link>
        {canEdit && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:border-orange-500/50 hover:bg-zinc-700 focus:ring-2 focus:ring-orange-500/50 focus:ring-offset-2 focus:ring-offset-zinc-950"
            >
              {displayLevel} ▾
            </button>
            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  aria-hidden
                  onClick={() => setShowDropdown(false)}
                />
                <ul
                  className="absolute right-0 top-full z-20 mt-1 min-w-[220px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl shadow-black/50"
                  role="listbox"
                >
                  <li role="option" aria-selected={currentLevel === undefined}>
                    <button
                      type="button"
                      onClick={() => {
                        onLevelChange(undefined);
                        setShowDropdown(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm ${currentLevel === undefined
                        ? "bg-orange-500/15 text-orange-400"
                        : "text-zinc-300 hover:bg-zinc-800"
                        }`}
                    >
                      —
                    </button>
                  </li>
                  {UNDERSTANDING_LEVELS.map((level) => (
                    <li
                      key={level}
                      role="option"
                      aria-selected={currentLevel === level}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onLevelChange(level);
                          setShowDropdown(false);
                        }}
                        className={`block w-full px-3 py-2 text-left text-sm ${currentLevel === level
                          ? "bg-orange-500/15 text-orange-400"
                          : "text-zinc-300 hover:bg-zinc-800"
                          }`}
                      >
                        {UNDERSTANDING_LEVEL_LABELS[level]}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}
