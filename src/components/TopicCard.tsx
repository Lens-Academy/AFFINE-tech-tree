import Link from "next/link";
import { useRouter } from "next/router";

import {
  type UnderstandingLevel,
  type UnderstandingLevelCounts,
} from "~/shared/understandingLevels";
import { type RouterOutputs } from "~/utils/api";
import { LevelDonut } from "./LevelDonut";
import { TopicAffordanceIcon } from "./TopicAffordanceIcon";
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
  levelCounts,
  totalRespondents = 0,
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
  levelCounts?: UnderstandingLevelCounts;
  totalRespondents?: number;
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
        <div className="-mt-1 flex shrink-0 items-center gap-1">
          {canBookmark && canMarkExcitedToTeach && (
            <TopicAffordanceIcon
              variant="interactive"
              kind="star"
              filled={!!excitedToTeach}
              onClick={onExcitedToTeachToggle}
              disabled={excitedToTeachDisabled}
              ariaLabel={
                excitedToTeach
                  ? "Remove excited to teach"
                  : "Mark excited to teach"
              }
              ariaPressed={!!excitedToTeach}
              title="Excited to teach"
              groupHover
              active={!!excitedToTeach && !!isActive}
            />
          )}
          {canBookmark && (
            <TopicAffordanceIcon
              variant="interactive"
              kind="bookmark"
              filled={!!bookmarked}
              onClick={onBookmarkToggle}
              disabled={bookmarkDisabled}
              ariaLabel={
                bookmarked ? "Remove bookmark" : "I'd like to learn this topic"
              }
              ariaPressed={!!bookmarked}
              title="I'd like to learn this topic"
              groupHover
              active={!!bookmarked && !!isActive}
            />
          )}
          {levelCounts && (
            <LevelDonut
              counts={levelCounts}
              totalRespondents={totalRespondents}
              size={20}
              className="ml-0.5 shrink-0"
            />
          )}
        </div>
      </div>
      {canEdit && (
        <div className="mt-4">
          <UnderstandingLevelCheckboxes
            currentLevel={currentLevel}
            isActive={isActive}
            onLevelChange={onLevelChange}
            counts={levelCounts}
          />
        </div>
      )}
    </li>
  );
}
