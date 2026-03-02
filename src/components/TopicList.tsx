import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import { useAppMutation } from "~/hooks/useAppMutation";
import { useTopicStatusMutations } from "~/hooks/useTopicStatusMutations";
import { authClient } from "~/server/better-auth/client";
import { type UnderstandingLevel } from "~/shared/understandingLevels";
import { api } from "~/utils/api";
import { TopicCard } from "./TopicCard";

type BookmarkMutationOptions = Exclude<
  Parameters<typeof api.bookmark.set.useMutation>[0],
  undefined
>;

export function TopicList() {
  const router = useRouter();
  const isTopicRoute = router.pathname === "/topic/[id]";
  const activeTopicId =
    isTopicRoute && typeof router.query.id === "string"
      ? Number(router.query.id)
      : undefined;
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [topicOrder, setTopicOrder] = useState<number[]>([]);
  const [lastAppliedSortKey, setLastAppliedSortKey] = useState("");
  const [initialSortApplied, setInitialSortApplied] = useState(false);
  const [bookmarkUpdatingTopicId, setBookmarkUpdatingTopicId] = useState<
    number | null
  >(null);
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const { data: allTopics, isLoading } = api.topic.list.useQuery();
  const { data: tags } = api.topic.listTags.useQuery();
  const { data: statuses, isFetched: statusesFetched } =
    api.userStatus.getAll.useQuery(undefined, {
      enabled: !!session?.user,
    });
  const { data: bookmarkedIds, isFetched: bookmarksFetched } =
    api.bookmark.getAll.useQuery(undefined, {
      enabled: !!session?.user,
    });
  const utils = api.useUtils();
  const bookmarkSet = useAppMutation(
    (opts: BookmarkMutationOptions) => api.bookmark.set.useMutation(opts),
    {
      onMutate: async (vars) => {
        const input = vars as { topicId: number; bookmarked: boolean };
        setBookmarkUpdatingTopicId(input.topicId);
        await utils.bookmark.getAll.cancel();
        const previous = utils.bookmark.getAll.getData();
        utils.bookmark.getAll.setData(undefined, (old) => {
          const set = new Set(old ?? []);
          if (input.bookmarked) set.add(input.topicId);
          else set.delete(input.topicId);
          return [...set];
        });
        return { previous };
      },
      onError: (_error, _vars, ctx) => {
        const context = ctx as { previous?: number[] } | undefined;
        if (context?.previous) {
          utils.bookmark.getAll.setData(undefined, context.previous);
        }
      },
      onSettled: () => {
        setBookmarkUpdatingTopicId(null);
      },
      refresh: [() => utils.bookmark.getAll.invalidate()],
    },
  );

  const { setStatus, removeStatus } = useTopicStatusMutations();

  const allTopicsList = useMemo(() => allTopics ?? [], [allTopics]);
  const visibleTopics = useMemo(
    () =>
      tagFilter
        ? allTopicsList.filter((t) =>
            t.topicTags.some((tt) => tt.tag.name === tagFilter),
          )
        : allTopicsList,
    [allTopicsList, tagFilter],
  );

  const bookmarkedSet = useMemo(
    () => new Set(bookmarkedIds ?? []),
    [bookmarkedIds],
  );
  const serverStatusByTopic = useMemo(
    () => new Map((statuses ?? []).map((s) => [s.topicId, s.level] as const)),
    [statuses],
  );
  const currentSortKey = useMemo(
    () => createSortKey(allTopicsList, bookmarkedSet, serverStatusByTopic),
    [allTopicsList, bookmarkedSet, serverStatusByTopic],
  );
  const initialSortReady =
    !isLoading && (!session?.user || (statusesFetched && bookmarksFetched));
  useEffect(() => {
    if (!session?.user) {
      setInitialSortApplied(false);
      setTopicOrder([]);
      return;
    }
    if (!initialSortReady || initialSortApplied) return;
    const initialOrder = sortTopicsByBookmarkAndUnderstanding(
      allTopicsList,
      bookmarkedSet,
      serverStatusByTopic,
    ).map((topic) => topic.id);
    setTopicOrder(initialOrder);
    setLastAppliedSortKey(currentSortKey);
    setInitialSortApplied(true);
  }, [
    initialSortReady,
    initialSortApplied,
    session?.user,
    allTopicsList,
    bookmarkedSet,
    serverStatusByTopic,
    currentSortKey,
  ]);
  const sortDirty = initialSortApplied && currentSortKey !== lastAppliedSortKey;
  const shouldHoldForInitialSort =
    sessionPending || (!!session?.user && !initialSortApplied);
  const topicsById = useMemo(
    () => new Map(allTopicsList.map((topic) => [topic.id, topic])),
    [allTopicsList],
  );
  const orderedTopics = useMemo(() => {
    if (topicOrder.length === 0) return visibleTopics;
    const visibleIds = new Set(visibleTopics.map((topic) => topic.id));
    const ordered = topicOrder.reduce<typeof visibleTopics>((acc, topicId) => {
      const topic = topicsById.get(topicId);
      if (!topic) return acc;
      if (!visibleIds.has(topic.id)) return acc;
      acc.push(topic);
      return acc;
    }, []);
    const orderedIds = new Set(ordered.map((topic) => topic.id));
    const missingVisible = visibleTopics.filter(
      (topic) => !orderedIds.has(topic.id),
    );
    return [...ordered, ...missingVisible];
  }, [topicOrder, topicsById, visibleTopics]);
  const applySort = () => {
    const sorted = sortTopicsByBookmarkAndUnderstanding(
      allTopicsList,
      bookmarkedSet,
      serverStatusByTopic,
    ).map((topic) => topic.id);
    setTopicOrder(sorted);
    setLastAppliedSortKey(currentSortKey);
  };
  const handleTagFilterChange = (nextTagFilter: string | null) => {
    if (tagFilter === nextTagFilter) return;
    setTagFilter(nextTagFilter);
  };

  return (
    <>
      <div
        className={
          isTopicRoute
            ? "mb-4 flex flex-wrap gap-2"
            : "mb-6 flex flex-wrap gap-2"
        }
      >
        <TagFilterButton
          label="All"
          dense={isTopicRoute}
          selected={tagFilter === null}
          onClick={() => handleTagFilterChange(null)}
        />
        {(tags ?? []).map((t) => (
          <TagFilterButton
            key={t.name}
            label={t.name}
            dense={isTopicRoute}
            selected={tagFilter === t.name}
            onClick={() => handleTagFilterChange(t.name)}
          />
        ))}
        {sortDirty && (
          <SortLinkButton dense={isTopicRoute} onClick={applySort} />
        )}
      </div>

      <div
        className={
          isTopicRoute
            ? "min-h-0 flex-1 overflow-y-auto pb-2 [scrollbar-gutter:stable] lg:pb-4"
            : undefined
        }
      >
        <div className={isTopicRoute ? "pr-2 lg:pr-4" : undefined}>
          {isLoading || shouldHoldForInitialSort ? (
            isTopicRoute ? (
              <TopicListSkeleton />
            ) : (
              <p className="text-zinc-500">Loading topics…</p>
            )
          ) : (
            <ul className="space-y-4">
              {orderedTopics.map((t) => (
                <TopicCard
                  key={t.id}
                  topic={t}
                  currentLevel={serverStatusByTopic.get(t.id)}
                  onLevelChange={(level) => {
                    if (level === undefined) {
                      removeStatus.mutate({ topicId: t.id });
                    } else {
                      setStatus.mutate({ topicId: t.id, level });
                    }
                  }}
                  canEdit={!!session?.user}
                  bookmarked={bookmarkedSet.has(t.id)}
                  onBookmarkToggle={() => {
                    if (bookmarkSet.isPending) return;
                    bookmarkSet.mutate({
                      topicId: t.id,
                      bookmarked: !bookmarkedSet.has(t.id),
                    });
                  }}
                  canBookmark={!!session?.user}
                  bookmarkDisabled={
                    bookmarkSet.isPending && bookmarkUpdatingTopicId === t.id
                  }
                  isActive={activeTopicId === t.id}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

const LEVEL_SORT_WEIGHT: Record<UnderstandingLevel, number> = {
  unfamiliar: 0,
  vague: 1,
  can_teach: 2,
  advanced_questions_welcome: 3,
};

function sortTopicsByBookmarkAndUnderstanding<T extends { id: number }>(
  topics: T[],
  bookmarkedSet: Set<number>,
  levelByTopic: Map<number, UnderstandingLevel>,
): T[] {
  return [...topics].sort((left, right) => {
    const bookmarkDelta =
      Number(bookmarkedSet.has(right.id)) - Number(bookmarkedSet.has(left.id));
    if (bookmarkDelta !== 0) return bookmarkDelta;

    const leftWeight = levelByTopic.has(left.id)
      ? LEVEL_SORT_WEIGHT[levelByTopic.get(left.id)!]
      : Number.MAX_SAFE_INTEGER;
    const rightWeight = levelByTopic.has(right.id)
      ? LEVEL_SORT_WEIGHT[levelByTopic.get(right.id)!]
      : Number.MAX_SAFE_INTEGER;
    if (leftWeight !== rightWeight) return leftWeight - rightWeight;

    // Keep backend/DB order for topics with equal sort priority.
    return 0;
  });
}

function createSortKey(
  topics: { id: number }[],
  bookmarkedSet: Set<number>,
  levelByTopic: Map<number, UnderstandingLevel>,
) {
  return topics
    .map((topic) => {
      const bookmarked = bookmarkedSet.has(topic.id) ? "1" : "0";
      const level = levelByTopic.get(topic.id) ?? "unknown";
      return `${topic.id}:${bookmarked}:${level}`;
    })
    .join("|");
}

function TopicListSkeleton() {
  return (
    <ul className="space-y-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <li
          key={index}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-5"
        >
          <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-800" />
          <div className="mt-2 h-4 w-full animate-pulse rounded bg-zinc-900" />
          <div className="mt-1 h-4 w-4/5 animate-pulse rounded bg-zinc-900" />
          <div className="mt-3 flex gap-2">
            <div className="h-5 w-14 animate-pulse rounded bg-zinc-800" />
            <div className="h-5 w-16 animate-pulse rounded bg-zinc-800" />
            <div className="h-5 w-12 animate-pulse rounded bg-zinc-800" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function TagFilterButton({
  label,
  dense,
  selected,
  onClick,
}: {
  label: string;
  dense: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        selected
          ? dense
            ? "rounded-full bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-400 ring-1 ring-orange-500/30 transition"
            : "rounded-full bg-orange-500/20 px-4 py-2 text-sm font-medium text-orange-400 ring-1 ring-orange-500/30 transition"
          : dense
            ? "rounded-full bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700/80 hover:text-zinc-300"
            : "rounded-full bg-zinc-800/80 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-700/80 hover:text-zinc-300"
      }
    >
      {label}
    </button>
  );
}

function SortLinkButton({
  dense,
  onClick,
}: {
  dense: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Sort by learning level"
      className={
        dense
          ? "px-1 py-1.5 text-xs text-orange-400 underline decoration-orange-400/40 underline-offset-2 transition hover:text-orange-300"
          : "px-1 py-2 text-sm text-orange-400 underline decoration-orange-400/40 underline-offset-2 transition hover:text-orange-300"
      }
    >
      Sort
    </button>
  );
}
