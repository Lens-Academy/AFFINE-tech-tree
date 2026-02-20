import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import { getLevelLabel, isTeacherLevel } from "~/shared/understandingLevels";
import { useAppMutation } from "~/hooks/useAppMutation";
import { authClient } from "~/server/better-auth/client";
import { AuthHeader } from "~/components/AuthHeader";
import { BookmarkIcon } from "~/components/BookmarkIcon";
import { FeedbackSection } from "~/components/FeedbackSection";
import { TopicList } from "~/components/TopicList";
import { api } from "~/utils/api";

type BookmarkMutationOptions = Exclude<
  Parameters<typeof api.bookmark.set.useMutation>[0],
  undefined
>;

export default function TopicPage() {
  const router = useRouter();
  const id =
    typeof router.query.id === "string" ? Number(router.query.id) : NaN;
  const { data: topic, isLoading } = api.topic.getById.useQuery(
    { id },
    { enabled: !Number.isNaN(id) },
  );
  const { data: session } = authClient.useSession();
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
      refresh: [() => utils.bookmark.getAll.invalidate()],
    },
  );
  const { data: teachers } = api.topic.getTeachers.useQuery(
    { topicId: id },
    { enabled: !!session?.user && !Number.isNaN(id) },
  );
  const isBookmarked = topic ? (bookmarkedIds ?? []).includes(topic.id) : false;

  const serverLevel =
    topic && statuses
      ? statuses.find((s) => s.topicId === topic.id)?.level
      : undefined;
  const currentLevel = serverLevel;
  const isTopicLoading = !Number.isNaN(id) && isLoading;
  const isTopicMissing = !isTopicLoading && !topic;

  return (
    <>
      <Head>
        <title>
          {topic?.name
            ? `${topic.name} | AFFINE Tech Tree`
            : "AFFINE Tech Tree"}
        </title>
      </Head>
      <main className="h-screen overflow-hidden bg-zinc-950">
        <header className="border-b border-zinc-800/80 bg-zinc-950/95">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-2 lg:px-4">
            <Link
              href="/"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              AFFINE Tech Tree
            </Link>
            <AuthHeader />
          </div>
        </header>

        <div className="mx-auto h-[calc(100%-4rem)] max-w-7xl px-4 md:px-2 lg:px-4">
          <div className="grid h-full min-h-0 md:grid-cols-2 md:gap-2 lg:gap-4">
            <section className="hidden min-h-0 flex-col border-r border-zinc-800/80 pr-2 transition-[opacity,transform] duration-300 ease-out md:flex lg:pr-4">
              <TopicList />
            </section>

            <section className="min-h-0 overflow-y-auto pt-2 pb-2 lg:pt-4 lg:pb-4">
              <div className="mx-auto max-w-3xl">
                {isTopicLoading && <p className="text-zinc-500">Loading…</p>}

                {isTopicMissing && (
                  <p className="text-zinc-500">Topic not found</p>
                )}

                {topic && (
                  <>
                    <div className="mb-2 flex items-center gap-3">
                      <h1 className="bg-linear-60 from-orange-400 to-zinc-100 to-5% bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
                        {topic.name}
                      </h1>
                      {session?.user && (
                        <button
                          type="button"
                          onClick={() => {
                            if (bookmarkSet.isPending) return;
                            bookmarkSet.mutate({
                              topicId: topic.id,
                              bookmarked: !isBookmarked,
                            });
                          }}
                          disabled={bookmarkSet.isPending}
                          title="I'd like to learn this topic"
                          className={`shrink-0 rounded-lg p-2 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 ${
                            isBookmarked
                              ? "text-orange-400"
                              : "text-zinc-600 hover:text-zinc-400"
                          }`}
                        >
                          <BookmarkIcon filled={isBookmarked} />
                        </button>
                      )}
                    </div>

                    <div className="mb-4 flex flex-wrap gap-1">
                      {topic.topicTags.map((tt) => (
                        <span
                          key={tt.tag.name}
                          className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                        >
                          {tt.tag.name}
                        </span>
                      ))}
                    </div>

                    {topic.description && (
                      <p className="mb-6 text-zinc-400">{topic.description}</p>
                    )}

                    <div id="feedback" />
                    {session?.user && !Number.isNaN(id) && (
                      <FeedbackSection
                        topicId={id}
                        topicLinks={topic.topicLinks ?? []}
                      />
                    )}

                    {topic.topicLinks && topic.topicLinks.length > 0 && (
                      <section className="mb-8">
                        <h2 className="mb-3 bg-clip-text text-lg font-semibold text-zinc-100">
                          Resources
                        </h2>
                        <ul className="space-y-2 text-sm">
                          {topic.topicLinks.map((link) =>
                            link.url ? (
                              <li key={link.id}>
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-orange-400 underline decoration-orange-400/30 underline-offset-2 visited:text-orange-500 hover:text-orange-300 hover:decoration-orange-300/50"
                                >
                                  {link.title}
                                </a>
                              </li>
                            ) : (
                              <li
                                key={link.id}
                                className="leading-relaxed text-zinc-300"
                              >
                                {link.title}
                              </li>
                            ),
                          )}
                        </ul>
                      </section>
                    )}

                    {topic.resources && topic.resources.length > 0 && (
                      <section className="mb-8">
                        <h2 className="mb-3 bg-clip-text text-lg font-semibold text-zinc-100">
                          Community resources
                        </h2>
                        <ul className="space-y-2">
                          {topic.resources.map((r) => (
                            <li key={r.id}>
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-orange-400 underline visited:text-orange-500 hover:text-orange-300"
                              >
                                {r.title}
                              </a>
                              {r.type && (
                                <span className="ml-2 text-xs text-zinc-500">
                                  {r.type}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {session?.user &&
                      !isTeacherLevel(currentLevel) &&
                      teachers &&
                      teachers.length > 0 && (
                        <section className="mb-8">
                          <h2 className="mb-3 bg-clip-text text-lg font-semibold text-zinc-100">
                            People who can help
                          </h2>
                          <ul className="space-y-2">
                            {teachers.map((t) => (
                              <li
                                key={t.userId}
                                className="flex items-center gap-2 text-sm text-zinc-300"
                              >
                                <span>{t.name ?? "Anonymous"}</span>
                                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                                  {getLevelLabel(t.level)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </section>
                      )}
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}
