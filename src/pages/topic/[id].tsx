import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import type { HelpfulnessRating } from "~/shared/feedbackTypes";
import type { UnderstandingLevel } from "~/shared/understandingLevels";
import { getLevelLabel, isTeacherLevel } from "~/shared/understandingLevels";
import { useAppMutation } from "~/hooks/useAppMutation";
import { authClient } from "~/server/better-auth/client";
import { AuthHeader } from "~/components/AuthHeader";
import { BookmarkIcon } from "~/components/BookmarkIcon";
import { CommentIcon } from "~/components/CommentIcon";
import {
  DebouncedTextarea,
  FeedbackSection,
  HelpfulnessSelect,
} from "~/components/FeedbackSection";
import { TopicList } from "~/components/TopicList";
import { api, type RouterOutputs } from "~/utils/api";

type BookmarkMutationOptions = Exclude<
  Parameters<typeof api.bookmark.set.useMutation>[0],
  undefined
>;
type SubmitTopicSuggestionMutationOptions = Exclude<
  Parameters<typeof api.topic.submitTopicFreeTextSuggestion.useMutation>[0],
  undefined
>;

const TOPIC_LIST_COLLAPSED_STORAGE_KEY =
  "affine.topic-detail.topic-list-collapsed";

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
  const [isTopicListCollapsed, setIsTopicListCollapsed] = useState(false);
  const [hasLoadedTopicListPreference, setHasLoadedTopicListPreference] =
    useState(false);
  const [rateMode, setRateMode] = useState(false);
  const [manualRateLevel, setManualRateLevel] =
    useState<UnderstandingLevel | null>(null);
  const [resourceSuggestionInput, setResourceSuggestionInput] = useState("");
  const [resourceSuggestionMessage, setResourceSuggestionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const submitTopicSuggestion = useAppMutation(
    (opts: SubmitTopicSuggestionMutationOptions) =>
      api.topic.submitTopicFreeTextSuggestion.useMutation(opts),
    {
      onMutate: () => {
        setResourceSuggestionMessage(null);
      },
      onSuccess: () => {
        setResourceSuggestionInput("");
        setResourceSuggestionMessage({
          type: "success",
          text: "Added to review queue.",
        });
      },
      onError: (error) => {
        setResourceSuggestionMessage({
          type: "error",
          text:
            error instanceof Error && error.message.trim().length > 0
              ? error.message
              : "Failed to add this suggestion.",
        });
      },
      refresh: [
        () => utils.feedback.getTransitionsByTopic.invalidate({ topicId: id }),
        () => utils.feedback.getRecentTransitions.invalidate(),
      ],
    },
  );
  const { data: manualFeedback } =
    api.feedback.getManualFeedbackByTopic.useQuery(
      { topicId: id, level: manualRateLevel },
      { enabled: !!session?.user && !Number.isNaN(id) && rateMode },
    );
  const ensureManualTransition = useAppMutation(
    (
      opts: Exclude<
        Parameters<
          typeof api.feedback.ensureManualFeedbackTransition.useMutation
        >[0],
        undefined
      >,
    ) => api.feedback.ensureManualFeedbackTransition.useMutation(opts),
    {
      refresh: [() => utils.feedback.getManualFeedbackByTopic.invalidate()],
    },
  );
  const upsertManualFeedback = useAppMutation(
    (
      opts: Exclude<
        Parameters<typeof api.feedback.upsertFeedbackItem.useMutation>[0],
        undefined
      >,
    ) => api.feedback.upsertFeedbackItem.useMutation(opts),
    {
      refresh: [
        () => utils.feedback.getManualFeedbackByTopic.invalidate(),
        () => utils.feedback.getTransitionsByTopic.invalidate({ topicId: id }),
        () => utils.feedback.getRecentTransitions.invalidate(),
      ],
    },
  );
  const isBookmarked = topic ? (bookmarkedIds ?? []).includes(topic.id) : false;

  const serverLevel =
    topic && statuses
      ? statuses.find((s) => s.topicId === topic.id)?.level
      : undefined;
  const currentLevel = serverLevel;
  const isTopicLoading = !Number.isNaN(id) && isLoading;
  const isTopicMissing = !isTopicLoading && !topic;

  useEffect(() => {
    if (!rateMode) return;
    const normalizedCurrentLevel = currentLevel ?? null;
    if (normalizedCurrentLevel !== manualRateLevel) {
      setRateMode(false);
      setManualRateLevel(null);
    }
  }, [rateMode, currentLevel, manualRateLevel]);

  useEffect(() => {
    const saved = window.localStorage.getItem(TOPIC_LIST_COLLAPSED_STORAGE_KEY);
    setIsTopicListCollapsed(saved === "1");
    setHasLoadedTopicListPreference(true);
  }, []);
  const toggleTopicList = () => {
    setIsTopicListCollapsed((previous) => {
      const next = !previous;
      if (next) {
        window.localStorage.setItem(TOPIC_LIST_COLLAPSED_STORAGE_KEY, "1");
      } else {
        window.localStorage.removeItem(TOPIC_LIST_COLLAPSED_STORAGE_KEY);
      }
      return next;
    });
  };

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

        <div
          className={`mx-auto h-[calc(100%-4rem)] max-w-7xl pl-4 md:pl-2 lg:pl-4 ${
            hasLoadedTopicListPreference ? "md:visible" : "md:invisible"
          }`}
        >
          <div
            className={`grid h-full min-h-0 md:gap-2 lg:gap-4 ${
              isTopicListCollapsed ? "md:grid-cols-1" : "md:grid-cols-2"
            }`}
          >
            <section
              className={`hidden min-h-0 flex-col border-r border-zinc-800/80 ${
                isTopicListCollapsed ? "md:hidden" : "md:flex"
              }`}
            >
              <TopicList />
            </section>

            <div className="relative min-h-0">
              <button
                type="button"
                onClick={toggleTopicList}
                className="absolute -left-6 z-20 hidden h-24 w-4 rounded-full border border-transparent text-zinc-400 hover:border-orange-500/40 hover:bg-zinc-900/95 hover:text-orange-300 md:flex"
                aria-label={
                  isTopicListCollapsed ? "Show topic list" : "Hide topic list"
                }
                aria-expanded={!isTopicListCollapsed}
                title={
                  isTopicListCollapsed ? "Show topic list" : "Hide topic list"
                }
              >
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M7 5V15" opacity="0.55" />
                  {isTopicListCollapsed ? (
                    <path d="M10 8L13 10L10 12" />
                  ) : (
                    <path d="M14 8L11 10L14 12" />
                  )}
                </svg>
              </button>
              <section className="h-full min-h-0 overflow-y-auto pt-2 pb-2 [scrollbar-gutter:stable] lg:pt-4 lg:pb-4">
                <div className="mx-auto max-w-3xl pr-2 lg:pr-3">
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
                        <p className="mb-6 text-zinc-400">
                          {topic.description}
                        </p>
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
                          <div className="mb-3 flex items-center gap-2">
                            <h2 className="bg-clip-text text-lg font-semibold text-zinc-100">
                              Resources
                            </h2>
                            {session?.user && (
                              <button
                                type="button"
                                onClick={() => {
                                  setRateMode((v) => {
                                    const next = !v;
                                    if (next) {
                                      setManualRateLevel(currentLevel ?? null);
                                    }
                                    return next;
                                  });
                                }}
                                className={`rounded p-1 transition ${
                                  rateMode
                                    ? "text-orange-400 hover:bg-zinc-800"
                                    : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                                }`}
                                title={
                                  rateMode
                                    ? "Exit rating mode"
                                    : "Rate resources"
                                }
                              >
                                <svg
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className="h-4 w-4"
                                >
                                  <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                                </svg>
                              </button>
                            )}
                          </div>
                          <ul className="space-y-2 text-sm">
                            {topic.topicLinks.map((link) => (
                              <li key={link.id}>
                                <InlineRateableResource
                                  link={link}
                                  rateMode={rateMode}
                                  manualFeedbackItems={
                                    manualFeedback?.feedbackItems ?? []
                                  }
                                  onUpsert={async (input) => {
                                    let transitionId =
                                      manualFeedback?.transitionId ?? null;
                                    if (transitionId == null) {
                                      const created =
                                        await ensureManualTransition.mutateAsync(
                                          {
                                            topicId: id,
                                            level: manualRateLevel,
                                          },
                                        );
                                      transitionId = created.transitionId;
                                    }
                                    upsertManualFeedback.mutate({
                                      ...input,
                                      topicId: id,
                                      transitionId,
                                    });
                                  }}
                                />
                              </li>
                            ))}
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
                                <li key={t.userId}>
                                  <div className="flex items-center gap-2 text-sm text-zinc-300">
                                    <span>{t.name ?? "Anonymous"}</span>
                                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                                      {getLevelLabel(t.level)}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </section>
                        )}

                      <section className="mb-8">
                        <h2 className="mb-3 bg-clip-text text-lg font-semibold text-zinc-100">
                          Add resource for review
                        </h2>
                        {resourceSuggestionMessage && (
                          <p
                            className={`mb-3 rounded border px-3 py-2 text-sm ${
                              resourceSuggestionMessage.type === "error"
                                ? "border-red-500/30 bg-red-500/10 text-red-300"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            }`}
                          >
                            {resourceSuggestionMessage.text}
                          </p>
                        )}
                        {!session?.user && (
                          <p className="mb-2 text-sm text-zinc-500">
                            Sign in to submit a resource for review.
                          </p>
                        )}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add resource URL, person, or note..."
                            value={resourceSuggestionInput}
                            onChange={(e) =>
                              setResourceSuggestionInput(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key !== "Enter") return;
                              e.preventDefault();
                              const value = resourceSuggestionInput.trim();
                              if (
                                !session?.user ||
                                !value ||
                                submitTopicSuggestion.isPending ||
                                Number.isNaN(id)
                              ) {
                                return;
                              }
                              submitTopicSuggestion.mutate({
                                topicId: id,
                                value,
                              });
                            }}
                            disabled={!session?.user}
                            className="flex-1 rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                          />
                          <button
                            type="button"
                            disabled={
                              !session?.user ||
                              submitTopicSuggestion.isPending ||
                              !resourceSuggestionInput.trim()
                            }
                            onClick={() => {
                              const value = resourceSuggestionInput.trim();
                              if (
                                !session?.user ||
                                !value ||
                                submitTopicSuggestion.isPending ||
                                Number.isNaN(id)
                              ) {
                                return;
                              }
                              submitTopicSuggestion.mutate({
                                topicId: id,
                                value,
                              });
                            }}
                            className="rounded bg-orange-500/20 px-3 py-1.5 text-sm text-orange-400 hover:bg-orange-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Add
                          </button>
                        </div>
                      </section>
                    </>
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

type ManualFeedbackItem =
  RouterOutputs["feedback"]["getManualFeedbackByTopic"]["feedbackItems"][number];

type ManualResourceUpsertInput = {
  topicId: number;
  transitionId: number;
  id?: number;
  type: "resource";
  topicLinkId: number;
  helpfulnessRating?: HelpfulnessRating | null;
  comment?: string | null;
};

function InlineRateableResource({
  link,
  rateMode,
  manualFeedbackItems,
  onUpsert,
}: {
  link: { id: number; title: string; url: string | null };
  rateMode: boolean;
  manualFeedbackItems: ManualFeedbackItem[];
  onUpsert: (
    input: Omit<ManualResourceUpsertInput, "topicId" | "transitionId">,
  ) => Promise<void>;
}) {
  const existing = manualFeedbackItems.find(
    (fi) => fi.type === "resource" && fi.topicLinkId === link.id,
  );
  const [showComment, setShowComment] = useState(false);
  const [rating, setRating] = useState<HelpfulnessRating | null>(null);
  const [comment, setComment] = useState("");
  const [hasLocalEdits, setHasLocalEdits] = useState(false);

  useEffect(() => {
    if (hasLocalEdits) return;
    setRating(existing?.helpfulnessRating ?? null);
    setComment(existing?.comment ?? "");
    setShowComment(!!existing?.comment);
  }, [existing, hasLocalEdits]);

  useEffect(() => {
    if (!rateMode) {
      setHasLocalEdits(false);
    }
  }, [rateMode]);

  const hasComment = comment.trim().length > 0;

  const doUpsert = async (patch: {
    helpfulnessRating?: HelpfulnessRating | null;
    comment?: string | null;
  }) => {
    await onUpsert({
      id: existing?.id,
      type: "resource",
      topicLinkId: link.id,
      ...patch,
    });
  };

  const linkEl = link.url ? (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-orange-400 underline decoration-orange-400/30 underline-offset-2 hover:text-orange-300 hover:decoration-orange-300/50"
    >
      {link.title}
    </a>
  ) : (
    <span className="leading-relaxed text-zinc-300">{link.title}</span>
  );

  if (!rateMode) return linkEl;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 truncate">{linkEl}</div>
        <div className="ml-auto flex items-center gap-1">
          <HelpfulnessSelect
            value={rating}
            onChange={(next) => {
              setHasLocalEdits(true);
              setRating(next);
              void doUpsert({ helpfulnessRating: next });
            }}
          />
          <button
            type="button"
            onClick={() => setShowComment((v) => !v)}
            className={`w-6 shrink-0 rounded p-1 transition ${
              hasComment
                ? "text-orange-300 hover:bg-zinc-700/60"
                : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
            }`}
            title={hasComment ? "Show comment" : "Add comment"}
          >
            <CommentIcon filled={hasComment} />
          </button>
        </div>
      </div>
      {showComment && (
        <DebouncedTextarea
          initialValue={comment}
          onLocalChange={(next) => {
            setHasLocalEdits(true);
            setComment(next);
          }}
          onSave={(next) => {
            void doUpsert({ comment: next || null });
          }}
          placeholder="Optional comment..."
        />
      )}
    </div>
  );
}
