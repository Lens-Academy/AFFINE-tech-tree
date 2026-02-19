import Head from "next/head";
import { useCallback, useMemo, useState } from "react";

import { useAppMutation } from "~/hooks/useAppMutation";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/utils/api";
import { AuthHeader } from "~/components/AuthHeader";
import { TopicCard } from "~/components/TopicCard";
import { useTopicStatusMutations } from "~/hooks/useTopicStatusMutations";

type BookmarkMutationOptions = Exclude<
  Parameters<typeof api.bookmark.set.useMutation>[0],
  undefined
>;

export default function Home() {
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const { data: session } = authClient.useSession();

  const { data: allTopics, isLoading } = api.topic.list.useQuery();
  const { data: tags } = api.topic.listTags.useQuery();
  const { data: statuses } = api.userStatus.getAll.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const { data: bookmarkedIds } = api.bookmark.getAll.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const [bookmarkUpdatingTopicId, setBookmarkUpdatingTopicId] = useState<
    number | null
  >(null);
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

  const topicNameById = useMemo(
    () => new Map((allTopics ?? []).map((t) => [t.id, t.name])),
    [allTopics],
  );
  const getTopicName = useCallback(
    (topicId: number) => topicNameById.get(topicId),
    [topicNameById],
  );
  const { setStatus, removeStatus } = useTopicStatusMutations(getTopicName);

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
            <h1 className="bg-linear-60 from-orange-400 to-zinc-100 to-15% bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
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
