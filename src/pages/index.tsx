import Head from "next/head";
import { useEffect, useMemo, useState } from "react";

import { type UnderstandingLevel } from "~/shared/understandingLevels";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/utils/api";
import { AuthHeader } from "~/components/AuthHeader";
import { TopicCard } from "~/components/TopicCard";
import { useTopicStatusMutations } from "~/hooks/useTopicStatusMutations";

export default function Home() {
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  /** Pending level per topic: level = setting, null = clearing, absent = use server */
  const [pendingLevelByTopic, setPendingLevelByTopic] = useState<
    Record<number, UnderstandingLevel | null | undefined>
  >({});
  const { data: session } = authClient.useSession();

  const { data: allTopics, isLoading } = api.topic.list.useQuery();
  const { data: tags } = api.topic.listTags.useQuery();
  const { data: statuses } = api.userStatus.getAll.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const { data: bookmarkedIds } = api.bookmark.getAll.useQuery(undefined, {
    enabled: !!session?.user,
  });
  /** Pending bookmark state: true = adding, false = removing, absent = use server */
  const [pendingBookmarks, setPendingBookmarks] = useState<Record<number, boolean>>({});
  const [bookmarkUpdatingByTopic, setBookmarkUpdatingByTopic] = useState<
    Record<number, boolean>
  >({});
  const utils = api.useUtils();
  const bookmarkSet = api.bookmark.set.useMutation();

  const clearPendingLevel = (topicId: number) => {
    setPendingLevelByTopic((old) => {
      const next = { ...old };
      delete next[topicId];
      return next;
    });
  };
  const { setStatus, removeStatus } = useTopicStatusMutations(clearPendingLevel);

  const topics = tagFilter
    ? (allTopics ?? []).filter((t) =>
        t.topicTags.some((tt) => tt.tag.name === tagFilter),
      )
    : (allTopics ?? []);

  const bookmarkedSet = useMemo(
    () => new Set(bookmarkedIds ?? []),
    [bookmarkedIds],
  );

  useEffect(() => {
    setPendingBookmarks((old) => {
      let changed = false;
      const next = { ...old };
      for (const [topicIdStr, pending] of Object.entries(old)) {
        const topicId = Number(topicIdStr);
        if (bookmarkedSet.has(topicId) === pending) {
          delete next[topicId];
          changed = true;
        }
      }
      return changed ? next : old;
    });
  }, [bookmarkedSet]);

  const serverStatusByTopic = useMemo(
    () => new Map((statuses ?? []).map((s) => [s.topicId, s.level] as const)),
    [statuses],
  );

  useEffect(() => {
    setPendingLevelByTopic((old) => {
      let changed = false;
      const next = { ...old };
      for (const [topicIdStr, pendingLevel] of Object.entries(old)) {
        const topicId = Number(topicIdStr);
        const serverLevel = serverStatusByTopic.get(topicId);
        if (
          serverLevel === pendingLevel ||
          (pendingLevel === null && serverLevel === undefined)
        ) {
          delete next[topicId];
          changed = true;
        }
      }
      return changed ? next : old;
    });
  }, [serverStatusByTopic]);

  return (
    <>
      <Head>
        <title>AFFINE Tech Tree</title>
        <meta
          name="description"
          content="Track your progress through AI alignment training material"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="min-h-screen bg-zinc-950 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-4xl">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="bg-linear-60 from-orange-400 to-15% to-zinc-100 bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
              AFFINE Tech Tree
            </h1>
            <AuthHeader />
          </header>

          <div className="mb-6 flex flex-wrap gap-2">
            <TagFilterButton
              label="All"
              selected={tagFilter === null}
              onClick={() => setTagFilter(null)}
            />
            {(tags ?? []).map((t) => (
              <TagFilterButton
                key={t.name}
                label={t.name}
                selected={tagFilter === t.name}
                onClick={() => setTagFilter(t.name)}
              />
            ))}
          </div>

          {isLoading ? (
            <p className="text-zinc-500">Loading topics…</p>
          ) : (
            <ul className="space-y-4">
              {(topics ?? []).map((t) => (
                <TopicCard
                  key={t.id}
                  topic={t}
                  currentLevel={
                    pendingLevelByTopic[t.id] === null
                      ? undefined
                      : pendingLevelByTopic[t.id] ?? serverStatusByTopic.get(t.id)
                  }
                  onLevelChange={(level) => {
                    if (level === undefined) {
                      setPendingLevelByTopic((old) => ({ ...old, [t.id]: null }));
                      removeStatus.mutate({ topicId: t.id });
                    } else {
                      setPendingLevelByTopic((old) => ({ ...old, [t.id]: level }));
                      setStatus.mutate({ topicId: t.id, level });
                    }
                  }}
                  canEdit={!!session?.user}
                  bookmarked={pendingBookmarks[t.id] ?? bookmarkedSet.has(t.id)}
                  onBookmarkToggle={() => {
                    if (bookmarkUpdatingByTopic[t.id]) return;
                    const current = pendingBookmarks[t.id] ?? bookmarkedSet.has(t.id);
                    const next = !current;
                    setPendingBookmarks((old) => ({ ...old, [t.id]: next }));
                    setBookmarkUpdatingByTopic((old) => ({ ...old, [t.id]: true }));
                    bookmarkSet.mutate(
                      { topicId: t.id, bookmarked: next },
                      {
                        onError: () => {
                          setPendingBookmarks((old) => ({ ...old, [t.id]: current }));
                        },
                        onSettled: () => {
                          setBookmarkUpdatingByTopic((old) => {
                            const nextState = { ...old };
                            delete nextState[t.id];
                            return nextState;
                          });
                          void utils.bookmark.getAll.invalidate();
                        },
                      },
                    );
                  }}
                  canBookmark={!!session?.user}
                  bookmarkDisabled={!!bookmarkUpdatingByTopic[t.id]}
                />
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

function TagFilterButton({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        selected
          ? "rounded-full bg-orange-500/20 px-4 py-2 text-sm font-medium text-orange-400 ring-1 ring-orange-500/30 transition"
          : "rounded-full bg-zinc-800/80 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:bg-zinc-700/80 hover:text-zinc-300"
      }
    >
      {label}
    </button>
  );
}
