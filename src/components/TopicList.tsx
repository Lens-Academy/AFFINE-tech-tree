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

  const topics = useMemo(
    () =>
      tagFilter
        ? (allTopics ?? []).filter((t) =>
          t.topicTags.some((tt) => tt.tag.name === tagFilter),
        )
        : (allTopics ?? []),
    [allTopics, tagFilter],
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
    () =>
      topics
        .map((topic) => {
          const bookmarked = bookmarkedSet.has(topic.id) ? "1" : "0";
          const level = serverStatusByTopic.get(topic.id) ?? "unknown";
          return `${topic.id}:${bookmarked}:${level}`;
        })
        .join("|"),
    [topics, bookmarkedSet, serverStatusByTopic],
  );
  const initialSortReady =
    !isLoading && (!session?.user || (statusesFetched && bookmarksFetched));
  useEffect(() => {
    if (!session?.user) {
      setInitialSortApplied(false);
      return;
    }
    if (!initialSortReady || initialSortApplied) return;
    const initialOrder = sortTopicsByBookmarkAndUnderstanding(
      topics,
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
    topics,
    bookmarkedSet,
    serverStatusByTopic,
    currentSortKey,
  ]);
  const sortDirty = initialSortApplied && currentSortKey !== lastAppliedSortKey;
  const shouldHoldForInitialSort =
    sessionPending || (!!session?.user && !initialSortApplied);
  const topicsById = useMemo(
    () => new Map(topics.map((topic) => [topic.id, topic])),
    [topics],
  );
  const orderedTopics = useMemo(() => {
    if (topicOrder.length === 0) return topics;
    const ordered = topicOrder
      .map((topicId) => topicsById.get(topicId))
      .filter((topic) => topic !== undefined);
    const visibleIds = new Set(ordered.map((topic) => topic.id));
    const missing = topics.filter((topic) => !visibleIds.has(topic.id));
    return [...ordered, ...missing];
  }, [topicOrder, topicsById, topics]);
  const applySort = () => {
    const sorted = sortTopicsByBookmarkAndUnderstanding(
      topics,
      bookmarkedSet,
      serverStatusByTopic,
    ).map((topic) => topic.id);
    setTopicOrder(sorted);
    setLastAppliedSortKey(currentSortKey);
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
          onClick={() => setTagFilter(null)}
        />
        {(tags ?? []).map((t) => (
          <TagFilterButton
            key={t.name}
            label={t.name}
            dense={isTopicRoute}
            selected={tagFilter === t.name}
            onClick={() => setTagFilter(t.name)}
          />
        ))}
        {sortDirty && (
          <SortLinkButton dense={isTopicRoute} onClick={applySort} />
        )}
      </div>

      <div
        className={
          isTopicRoute
            ? "min-h-0 flex-1 overflow-y-auto pb-2 lg:pb-4"
            : undefined
        }
      >
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
    </>
  );
}

const LEVEL_SORT_WEIGHT: Record<UnderstandingLevel, number> = {
  unfamiliar: 0,
  vague: 1,
  can_teach: 2,
  advanced_questions_welcome: 3,
};

function sortTopicsByBookmarkAndUnderstanding<
  T extends { id: number; name: string },
>(
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

    return left.name.localeCompare(right.name);
  });
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
