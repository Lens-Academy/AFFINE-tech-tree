import Link from "next/link";
import { useRouter } from "next/router";

import { type UnderstandingLevel } from "~/shared/understandingLevels";
import { type RouterOutputs } from "~/utils/api";
import { BookmarkIcon } from "./BookmarkIcon";
import { UnderstandingLevelCheckboxes } from "./UnderstandingLevelCheckboxes";

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
  isActive,
}: {
  topic: Topic;
  currentLevel?: UnderstandingLevel;
  onLevelChange: (level: UnderstandingLevel | undefined) => void;
  canEdit: boolean;
  bookmarked?: boolean;
  onBookmarkToggle?: () => void;
  canBookmark?: boolean;
  bookmarkDisabled?: boolean;
  isActive?: boolean;
}) {
  const router = useRouter();
  const isTopicRoute = router.pathname === "/topic/[id]";

  return (
    <li
      className={`group relative rounded-xl border bg-zinc-900/50 transition ${
        isTopicRoute ? "p-3 lg:p-4" : "p-4 md:p-5"
      } ${
        isActive ? "border-zinc-700" : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start gap-2">
        <Link href={`/topic/${topic.id}`} className="block min-w-0 flex-1">
          <h2
            className={`-mt-0.5 bg-linear-60 from-orange-400 to-zinc-100 bg-clip-text text-lg font-semibold text-transparent ${
              isActive ? "to-100%" : "to-1% group-hover:to-100%"
            }`}
          >
            {topic.name}
          </h2>
          {topic.description && (
            <p className="mt-1 line-clamp-2 text-sm text-zinc-400">
              {topic.description}
            </p>
          )}
        </Link>
        {canBookmark && (
          <button
            type="button"
            onClick={onBookmarkToggle}
            disabled={bookmarkDisabled}
            title="I'd like to learn this topic"
            className={`-mt-1 -mr-1.5 shrink-0 rounded-lg p-1 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 ${
              bookmarked
                ? "text-orange-400"
                : "text-zinc-600 hover:text-zinc-400"
            }`}
          >
            <BookmarkIcon filled={!!bookmarked} />
          </button>
        )}
      </div>
      {canEdit && (
        <div className="mt-4">
          <UnderstandingLevelCheckboxes
            currentLevel={currentLevel}
            onLevelChange={(level) => {
              onLevelChange(level);
              if (isTopicRoute) {
                void router.push(`/topic/${topic.id}`);
              }
            }}
          />
        </div>
      )}
    </li>
  );
}
