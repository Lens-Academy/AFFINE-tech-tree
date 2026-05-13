import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import { useAppMutation } from "~/hooks/useAppMutation";
import { useInitialActiveTopicScroll } from "~/hooks/useInitialActiveTopicScroll";
import { useTopicListFilters } from "~/hooks/useTopicListFilters";
import { useViewerAccess } from "~/hooks/useViewerAccess";
import { useTopicStatusMutations } from "~/hooks/useTopicStatusMutations";
import {
  isTeacherLevel,
  type UnderstandingLevel,
} from "~/shared/understandingLevels";
import { api } from "~/utils/api";
import { TopicCard } from "./TopicCard";

type BookmarkMutationOptions = Exclude<
  Parameters<typeof api.bookmark.set.useMutation>[0],
  undefined
>;
type ExcitedToTeachMutationOptions = Exclude<
  Parameters<typeof api.excitedToTeach.set.useMutation>[0],
  undefined
>;

export function TopicList() {
  const router = useRouter();
  const activeTopicId =
    router.pathname === "/topic/[id]" && typeof router.query.id === "string"
      ? Number(router.query.id)
      : undefined;
  const [topicOrder, setTopicOrder] = useState<number[]>([]);
  const [lastAppliedSortKey, setLastAppliedSortKey] = useState("");
  const [initialSortApplied, setInitialSortApplied] = useState(false);
  const [bookmarkUpdatingTopicId, setBookmarkUpdatingTopicId] = useState<
    number | null
  >(null);
  const [excitedUpdatingTopicId, setExcitedUpdatingTopicId] = useState<
    number | null
  >(null);
  const { viewerUser } = useViewerAccess();
  const { data: allTopics, isLoading } = api.topic.list.useQuery();
  const { data: tags, isPending: tagsPending } = api.topic.listTags.useQuery();
  const {
    searchQuery,
    tagFilter,
    setTagFilter,
    updateSearchQuery,
    isStoredTagLoaded,
  } = useTopicListFilters(tags);
  const { data: statuses, isFetched: statusesFetched } =
    api.userStatus.getAll.useQuery(undefined, {
      enabled: !!viewerUser,
    });
  const { data: bookmarkedIds, isFetched: bookmarksFetched } =
    api.bookmark.getAll.useQuery(undefined, {
      enabled: !!viewerUser,
    });
  const { data: excitedToTeachIds, isFetched: excitedToTeachFetched } =
    api.excitedToTeach.getAll.useQuery(undefined, {
      enabled: !!viewerUser,
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
        if (context && "previous" in context) {
          utils.bookmark.getAll.setData(undefined, context.previous);
        }
      },
      onSettled: () => {
        setBookmarkUpdatingTopicId(null);
      },
      refresh: [
        () => utils.bookmark.getAll.invalidate(),
        () => utils.match.invalidate(),
      ],
    },
  );
  const excitedToTeachSet = useAppMutation(
    (opts: ExcitedToTeachMutationOptions) =>
      api.excitedToTeach.set.useMutation(opts),
    {
      onMutate: async (vars) => {
        const input = vars as { topicId: number; excited: boolean };
        setExcitedUpdatingTopicId(input.topicId);
        await utils.excitedToTeach.getAll.cancel();
        const previous = utils.excitedToTeach.getAll.getData();
        utils.excitedToTeach.getAll.setData(undefined, (old) => {
          const set = new Set(old ?? []);
          if (input.excited) set.add(input.topicId);
          else set.delete(input.topicId);
          return [...set];
        });
        return { previous };
      },
      onError: (_error, _vars, ctx) => {
        const context = ctx as { previous?: number[] } | undefined;
        if (context && "previous" in context) {
          utils.excitedToTeach.getAll.setData(undefined, context.previous);
        }
      },
      onSettled: () => {
        setExcitedUpdatingTopicId(null);
      },
      refresh: [
        () => utils.excitedToTeach.getAll.invalidate(),
        () => utils.match.invalidate(),
      ],
    },
  );

  const { setStatus, removeStatus } = useTopicStatusMutations();

  const allTopicsList = useMemo(() => allTopics ?? [], [allTopics]);
  const visibleTopics = useMemo(() => {
    let filtered = allTopicsList;

    // Filter by tag
    if (tagFilter) {
      filtered = filtered.filter((t) =>
        t.topicTags.some((tt) => tt.tag.name === tagFilter),
      );
    }

    // Filter by search query
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false),
      );
    }

    return filtered;
  }, [allTopicsList, tagFilter, searchQuery]);

  const bookmarkedSet = useMemo(
    () => new Set(bookmarkedIds ?? []),
    [bookmarkedIds],
  );
  const excitedToTeachSetIds = useMemo(
    () => new Set(excitedToTeachIds ?? []),
    [excitedToTeachIds],
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
    !isLoading &&
    (!viewerUser ||
      (statusesFetched && bookmarksFetched && excitedToTeachFetched));
  useEffect(() => {
    if (!viewerUser) {
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
    viewerUser,
    allTopicsList,
    bookmarkedSet,
    serverStatusByTopic,
    currentSortKey,
  ]);
  const sortDirty = initialSortApplied && currentSortKey !== lastAppliedSortKey;
  const shouldHoldForInitialRender =
    isLoading || !isStoredTagLoaded || tagsPending;
  const isListRendered = !shouldHoldForInitialRender;
  useInitialActiveTopicScroll(activeTopicId, isListRendered);
  const topicsById = useMemo(
    () => new Map(allTopicsList.map((topic) => [topic.id, topic])),
    [allTopicsList],
  );
  const orderedTopics = useMemo(() => {
    if (topicOrder.length === 0) {
      return sortTopicsByBookmarkAndUnderstanding(
        visibleTopics,
        bookmarkedSet,
        serverStatusByTopic,
      );
    }
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
  }, [
    topicOrder,
    topicsById,
    visibleTopics,
    bookmarkedSet,
    serverStatusByTopic,
  ]);
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

  if (shouldHoldForInitialRender) {
    return <TopicListSkeleton />;
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <TagFilterButton
          label="All"
          selected={tagFilter === null}
          onClick={() => handleTagFilterChange(null)}
        />
        {(tags ?? []).map((t) => (
          <TagFilterButton
            key={t.name}
            label={t.name}
            description={t.description}
            selected={tagFilter === t.name}
            onClick={() => handleTagFilterChange(t.name)}
          />
        ))}
        {sortDirty && <SortLinkButton onClick={applySort} />}
      </div>
      <input
        type="search"
        placeholder="Search topics by name or description…"
        value={searchQuery}
        onChange={(e) => updateSearchQuery(e.target.value)}
        className="mb-4 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-zinc-500"
      />

      <ul className="space-y-4">
        {orderedTopics.map((t) => {
          const displayLevel =
            setStatus.isPending && setStatus.variables?.topicId === t.id
              ? setStatus.variables.level
              : removeStatus.isPending && removeStatus.variables?.topicId === t.id
                ? undefined
                : serverStatusByTopic.get(t.id);
          return (
          <TopicCard
            key={t.id}
            topic={t}
            currentLevel={displayLevel}
            onLevelChange={(level) => {
              if (level === undefined) {
                removeStatus.mutate({ topicId: t.id });
              } else {
                setStatus.mutate({ topicId: t.id, level });
              }
            }}
            canEdit={!!viewerUser}
            bookmarked={bookmarkedSet.has(t.id)}
            onBookmarkToggle={() => {
              if (bookmarkSet.isPending) return;
              bookmarkSet.mutate({
                topicId: t.id,
                bookmarked: !bookmarkedSet.has(t.id),
              });
            }}
            canBookmark={!!viewerUser}
            bookmarkDisabled={
              bookmarkSet.isPending && bookmarkUpdatingTopicId === t.id
            }
            canMarkExcitedToTeach={isTeacherLevel(displayLevel)}
            excitedToTeach={excitedToTeachSetIds.has(t.id)}
            onExcitedToTeachToggle={() => {
              if (excitedToTeachSet.isPending) return;
              excitedToTeachSet.mutate({
                topicId: t.id,
                excited: !excitedToTeachSetIds.has(t.id),
              });
            }}
            excitedToTeachDisabled={
              excitedToTeachSet.isPending && excitedUpdatingTopicId === t.id
            }
            isActive={activeTopicId === t.id}
          />
          );
        })}
      </ul>
    </>
  );
}

const LEVEL_SORT_WEIGHT: Record<UnderstandingLevel, number> = {
  advanced_questions_welcome: 0,
  can_teach: 1,
  vague: 2,
  unfamiliar: 3,
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
      : -1;
    const rightWeight = levelByTopic.has(right.id)
      ? LEVEL_SORT_WEIGHT[levelByTopic.get(right.id)!]
      : -1;
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
          className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 md:p-5"
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
  description,
  selected,
  onClick,
}: {
  label: string;
  description?: string | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <span className="group relative">
      <button
        type="button"
        onClick={onClick}
        className={
          selected
            ? "rounded-full bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-400 ring-1 ring-orange-500/30 transition"
            : "rounded-full bg-zinc-800/80 px-3 py-1.5 text-xs font-medium text-zinc-400 transition hover:bg-zinc-700/80 hover:text-zinc-300"
        }
      >
        {label}
      </button>
      {description && (
        <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-56 -translate-x-1/2 rounded bg-zinc-900 px-2 py-1 text-xs text-zinc-100 opacity-0 shadow-lg ring-1 ring-zinc-600 transition-opacity group-hover:opacity-100">
          {description}
        </span>
      )}
    </span>
  );
}

function SortLinkButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Sort by learning level"
      className="px-1 py-1.5 text-xs text-orange-400 underline decoration-orange-400/40 underline-offset-2 transition hover:text-orange-300"
    >
      Sort
    </button>
  );
}
