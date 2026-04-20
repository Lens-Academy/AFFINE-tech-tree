import Link from "next/link";
import { useRouter } from "next/router";

import { type UnderstandingLevel } from "~/shared/understandingLevels";
import { type RouterOutputs } from "~/utils/api";
import { BookmarkIcon } from "./BookmarkIcon";
import { StarIcon } from "./StarIcon";
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
  excitedToTeach,
  onExcitedToTeachToggle,
  excitedToTeachDisabled,
  canMarkExcitedToTeach,
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
  excitedToTeach?: boolean;
  onExcitedToTeachToggle?: () => void;
  excitedToTeachDisabled?: boolean;
  canMarkExcitedToTeach?: boolean;
  isActive?: boolean;
}) {
  const router = useRouter();
  const isTopicRoute = router.pathname === "/topic/[id]";
  const q = typeof router.query.q === "string" ? router.query.q : undefined;
  const topicHref = {
    pathname: "/topic/[id]",
    query: {
      id: String(topic.id),
      ...(q ? { q } : {}),
    },
  };

  return (
    <li
      data-topic-id={topic.id}
      className={`group relative rounded-lg border bg-zinc-900/50 transition ${
        isTopicRoute ? "p-3 lg:p-4" : "p-4 md:p-5"
      } ${
        isActive ? "border-orange-500" : "border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start gap-2">
        <Link href={topicHref} className="block min-w-0 flex-1">
          <h2
            className={`-mt-0.5 bg-linear-60 from-orange-400 to-zinc-100 bg-clip-text text-lg font-semibold text-transparent ${
              isActive ? "to-200%" : "to-1% group-hover:to-100%"
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
          <div className="-mt-1 -mr-1.5 flex shrink-0 items-center">
            {canMarkExcitedToTeach && (
              <button
                type="button"
                onClick={onExcitedToTeachToggle}
                disabled={excitedToTeachDisabled}
                aria-label={
                  excitedToTeach
                    ? "Remove excited to teach"
                    : "Mark excited to teach"
                }
                aria-pressed={!!excitedToTeach}
                title="Excited to teach"
                className={`rounded-lg p-1 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 ${
                  excitedToTeach
                    ? isActive
                      ? "text-orange-400"
                      : "text-zinc-600 group-hover:text-orange-400"
                    : "text-zinc-600 hover:text-orange-400"
                }`}
              >
                <StarIcon filled={!!excitedToTeach} />
              </button>
            )}
            <button
              type="button"
              onClick={onBookmarkToggle}
              disabled={bookmarkDisabled}
              title="I'd like to learn this topic"
              className={`rounded-lg p-1 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 ${
                bookmarked
                  ? isActive
                    ? "text-orange-400"
                    : "text-zinc-600 group-hover:text-orange-400"
                  : "text-zinc-600 hover:text-orange-400"
              }`}
            >
              <BookmarkIcon filled={!!bookmarked} />
            </button>
          </div>
        )}
      </div>
      {canEdit && (
        <div className="mt-4">
          <UnderstandingLevelCheckboxes
            currentLevel={currentLevel}
            isActive={isActive}
            onLevelChange={(level) => {
              onLevelChange(level);
              void router.push(topicHref);
            }}
          />
        </div>
      )}
    </li>
  );
}
