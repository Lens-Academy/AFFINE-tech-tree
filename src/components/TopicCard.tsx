import Link from "next/link";
import { useEffect, useState } from "react";

import {
  getLevelLabel,
  UNDERSTANDING_LEVEL_LABELS,
  UNDERSTANDING_LEVELS,
  type UnderstandingLevel,
} from "~/shared/understandingLevels";
import { type RouterOutputs } from "~/utils/api";
import { BookmarkIcon } from "./BookmarkIcon";

type Topic = RouterOutputs["topic"]["list"][number];

export function TopicCard({
  topic,
  currentLevel,
  onLevelChange,
  canEdit,
  bookmarked,
  onBookmarkToggle,
  canBookmark,
  bookmarkDisabled,
}: {
  topic: Topic;
  currentLevel?: UnderstandingLevel;
  onLevelChange: (level: UnderstandingLevel | undefined) => void;
  canEdit: boolean;
  bookmarked?: boolean;
  onBookmarkToggle?: () => void;
  canBookmark?: boolean;
  bookmarkDisabled?: boolean;
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

  const displayLevel = currentLevel ? getLevelLabel(currentLevel) : "—";

  return (
    <li className="group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 transition hover:border-zinc-700 md:p-5">
      {canBookmark && (
        <button
          type="button"
          onClick={onBookmarkToggle}
          disabled={bookmarkDisabled}
          title="I'd like to learn this topic"
          className={`absolute right-3 top-3 shrink-0 rounded-lg p-1 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 md:right-4 md:top-4 ${
            bookmarked ? "text-orange-400" : "text-zinc-600 hover:text-zinc-400"
          }`}
        >
          <BookmarkIcon filled={!!bookmarked} />
        </button>
      )}
      <Link href={`/topic/${topic.id}`} className="block">
        <h2 className="-mt-0.5 text-lg font-semibold bg-linear-60 from-orange-400 to-1% to-zinc-100 group-hover:to-100% bg-clip-text text-transparent">
          {topic.name}
        </h2>
        {topic.description && (
          <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
            {topic.description}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1">
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
        <div className="relative -mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setShowDropdown(!showDropdown)}
            title="Level of understanding"
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
                className="absolute right-0 bottom-full z-20 mb-1 min-w-[220px] rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl shadow-black/50"
                role="listbox"
              >
                <li className="px-3 py-1.5 text-xs font-medium text-zinc-500">
                  Level of understanding
                </li>
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
    </li>
  );
}
