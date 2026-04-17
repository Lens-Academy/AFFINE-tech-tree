import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

import { AuthHeader } from "~/components/AuthHeader";
import { BookmarkIcon } from "~/components/BookmarkIcon";
import { StarIcon } from "~/components/StarIcon";
import { useViewerAccess } from "~/hooks/useViewerAccess";
import { getLevelShortLabel } from "~/shared/understandingLevels";
import { api } from "~/utils/api";

export default function MatchPage() {
  const router = useRouter();
  const rawId = router.query.id;
  const matchId =
    typeof rawId === "string" ? Number.parseInt(rawId, 10) : Number.NaN;
  const validId = Number.isFinite(matchId) && matchId > 0;
  const { rawUser, viewerUser, isPending } = useViewerAccess();

  const match = api.match.getMatchTopics.useQuery(
    { matchId },
    { enabled: !!viewerUser && validId },
  );

  return (
    <>
      <Head>
        <title>Match | AFFINE Tech Tree</title>
      </Head>
      <main className="min-h-screen bg-zinc-950 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/users"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Back to peers
            </Link>
            <AuthHeader />
          </div>

          {isPending && <p className="text-zinc-500">Loading session…</p>}
          {!isPending && !rawUser && (
            <p className="text-zinc-400">Please sign in.</p>
          )}

          {match.isLoading && <p className="text-zinc-500">Loading match…</p>}
          {match.error && <p className="text-red-400">{match.error.message}</p>}

          {match.data && (
            <div className="space-y-4">
              <h1 className="text-3xl font-bold text-zinc-100">
                Tuition topics with{" "}
                {match.data.otherUser.name ?? match.data.otherUser.email}
              </h1>
              <p className="text-sm text-zinc-500">
                Topics where one of you can teach and the other has a lower
                level, sorted by expected value.
              </p>

              {match.data.entries.length === 0 ? (
                <p className="text-zinc-400">
                  No overlapping tuition topics found yet. Try starring more
                  topics or setting more levels.
                </p>
              ) : (
                <ul className="space-y-2">
                  {match.data.entries.map((e) => (
                    <li key={e.topicId}>
                      <Link
                        href={`/topic/${e.topicId}`}
                        className="group block rounded border border-zinc-800 bg-zinc-900 p-3 transition hover:border-orange-500/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-orange-400 group-hover:text-orange-300">
                            {e.name}
                          </span>
                          <div className="flex items-center gap-1">
                            <span
                              title={
                                e.teacherStarred
                                  ? `${e.teacherName} is excited to teach`
                                  : "Not excited to teach"
                              }
                              className="rounded-lg p-1 text-zinc-600 transition group-hover:text-orange-400"
                            >
                              <StarIcon filled={e.teacherStarred} />
                            </span>
                            <span
                              title={
                                e.learnerBookmarked
                                  ? `bookmarked by ${e.learnerName}`
                                  : "Not bookmarked"
                              }
                              className="rounded-lg p-1 text-zinc-600 transition group-hover:text-orange-400"
                            >
                              <BookmarkIcon filled={e.learnerBookmarked} />
                            </span>
                            <span className="ml-1 text-xs text-zinc-500">
                              {getLevelShortLabel(e.teacherLevel)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          {e.teacherName} teaches {e.learnerName}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
