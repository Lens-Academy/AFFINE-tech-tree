import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef } from "react";

import { LevelDot } from "~/components/LevelDot";
import { PageShell } from "~/components/PageShell";
import { TopicAffordanceIcon } from "~/components/TopicAffordanceIcon";
import { FloatingTopicPreview } from "~/features/topic-detail/FloatingTopicPreview";
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

  const selectedTopicId = parseTopicParam(router.query.topic);
  const listSectionRef = useRef<HTMLDivElement>(null);
  const hasMountedRef = useRef(false);
  const animatePreview = hasMountedRef.current;
  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

  const setSelectedTopicId = useCallback(
    (id: number | null) => {
      const rest = Object.fromEntries(
        Object.entries(router.query).filter(([key]) => key !== "topic"),
      );
      const query = id !== null ? { ...rest, topic: String(id) } : rest;
      void router.push({ pathname: router.pathname, query }, undefined, {
        shallow: true,
        scroll: false,
      });
    },
    [router],
  );

  return (
    <>
      <Head>
        <title>Match | AFFINE Tech Tree</title>
      </Head>
      <PageShell
        mainClassName={`transition-[max-width] duration-220 ease-out motion-reduce:transition-none ${
          selectedTopicId !== null ? "max-w-7xl" : "max-w-5xl"
        }`}
      >
        <div
          ref={listSectionRef}
          className={`rounded-lg border border-zinc-800 bg-zinc-900 p-4 transition-[padding-right] duration-220 ease-out motion-reduce:transition-none md:p-6 ${
            selectedTopicId !== null ? "md:pr-[min(60vw,560px)]" : ""
          }`}
        >
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
                  {match.data.entries.map((e) => {
                    const isActive = selectedTopicId === e.topicId;
                    const teacherLevelLabel = getLevelShortLabel(
                      e.teacherLevel,
                    );
                    const learnerLevelLabel = e.learnerLevel
                      ? getLevelShortLabel(e.learnerLevel)
                      : "No level set";
                    return (
                      <li key={e.topicId}>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTopicId(isActive ? null : e.topicId)
                          }
                          aria-pressed={isActive}
                          className={`group block w-full rounded-lg border bg-zinc-900/50 p-3 text-left transition ${
                            isActive
                              ? "border-orange-500"
                              : "border-zinc-800 hover:border-zinc-700"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`bg-linear-60 from-orange-400 to-zinc-100 bg-clip-text text-sm font-semibold text-transparent ${
                                isActive
                                  ? "to-200%"
                                  : "to-1% group-hover:to-100%"
                              }`}
                            >
                              {e.name}
                            </span>
                            <div className="flex items-center gap-1">
                              {e.teacherStarred && (
                                <TopicAffordanceIcon
                                  variant="read-only"
                                  kind="star"
                                  filled
                                  title={`${e.teacherName} is excited to teach`}
                                  className="rounded-lg p-1"
                                  groupHover
                                  active={isActive}
                                />
                              )}
                              <TopicAffordanceIcon
                                variant="read-only"
                                kind="bookmark"
                                filled={e.learnerBookmarked}
                                title={
                                  e.learnerBookmarked
                                    ? `bookmarked by ${e.learnerName}`
                                    : `not bookmarked by ${e.learnerName}`
                                }
                                className="rounded-lg p-1"
                                groupHover
                                active={isActive}
                              />
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-500">
                            <LevelDot
                              level={e.teacherLevel}
                              label={teacherLevelLabel}
                              title={teacherLevelLabel}
                            />
                            <span>{e.teacherName}</span>
                            <span>teaches</span>
                            <span>{e.learnerName}</span>
                            <LevelDot
                              level={e.learnerLevel}
                              label={learnerLevelLabel}
                              title={learnerLevelLabel}
                            />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
        {selectedTopicId !== null && (
          <FloatingTopicPreview
            topicId={selectedTopicId}
            onClose={() => setSelectedTopicId(null)}
            onSelectTopic={(id) => setSelectedTopicId(id)}
            anchorRef={listSectionRef}
            animateIn={animatePreview}
          />
        )}
      </PageShell>
    </>
  );
}

function parseTopicParam(value: string | string[] | undefined): number | null {
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
