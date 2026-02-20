import { useMemo, useState } from "react";
import { useRouter } from "next/router";

import { useAppMutation } from "~/hooks/useAppMutation";
import { useTopicStatusMutations } from "~/hooks/useTopicStatusMutations";
import { authClient } from "~/server/better-auth/client";
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
  const [bookmarkUpdatingTopicId, setBookmarkUpdatingTopicId] = useState<
    number | null
  >(null);
  const { data: session } = authClient.useSession();
  const { data: allTopics, isLoading } = api.topic.list.useQuery();
  const { data: tags } = api.topic.listTags.useQuery();
  const { data: statuses } = api.userStatus.getAll.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const { data: bookmarkedIds } = api.bookmark.getAll.useQuery(undefined, {
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

  const topics = tagFilter
    ? (allTopics ?? []).filter((t) =>
        t.topicTags.some((tt) => tt.tag.name === tagFilter),
      )
    : (allTopics ?? []);

  const bookmarkedSet = useMemo(
    () => new Set(bookmarkedIds ?? []),
    [bookmarkedIds],
  );
  const serverStatusByTopic = useMemo(
    () => new Map((statuses ?? []).map((s) => [s.topicId, s.level] as const)),
    [statuses],
  );

  return (
    <>
      {isTopicRoute && (
        <div className="pt-2 lg:pt-4">
          <p className="text-xs tracking-wide text-zinc-500 uppercase">
            Topics
          </p>
        </div>
      )}
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
      </div>

      <div
        className={
          isTopicRoute
            ? "min-h-0 flex-1 overflow-y-auto pb-2 lg:pb-4"
            : undefined
        }
      >
        {isLoading ? (
          isTopicRoute ? (
            <TopicListSkeleton />
          ) : (
            <p className="text-zinc-500">Loading topics…</p>
          )
        ) : (
          <ul className="space-y-4">
            {topics.map((t) => (
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
