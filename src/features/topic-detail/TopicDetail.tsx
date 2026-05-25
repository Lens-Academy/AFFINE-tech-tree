import Link from "next/link";
import { useEffect, useState } from "react";

import { CommentIcon } from "~/components/CommentIcon";
import {
  DebouncedTextarea,
  FeedbackSection,
} from "~/components/FeedbackSection";
import { TopicAffordanceIcon } from "~/components/TopicAffordanceIcon";
import { UnderstandingLevelCheckboxes } from "~/components/UnderstandingLevelCheckboxes";
import { useAppMutation } from "~/hooks/useAppMutation";
import { useLevelCounts } from "~/hooks/useLevelCounts";
import { useTopicStatusMutations } from "~/hooks/useTopicStatusMutations";
import { useViewerAccess } from "~/hooks/useViewerAccess";
import { getErrorMessage, showGlobalErrorToast } from "~/lib/globalErrorToast";
import type { HelpfulnessRating } from "~/shared/feedbackTypes";
import { HELPFULNESS_RATINGS } from "~/shared/feedbackTypes";
import type { UnderstandingLevel } from "~/shared/understandingLevels";
import { getLevelLabel, isTeacherLevel } from "~/shared/understandingLevels";
import { api, type RouterOutputs } from "~/utils/api";

type BookmarkMutationOptions = Exclude<
  Parameters<typeof api.bookmark.set.useMutation>[0],
  undefined
>;
type ExcitedToTeachMutationOptions = Exclude<
  Parameters<typeof api.excitedToTeach.set.useMutation>[0],
  undefined
>;
type SubmitTopicSuggestionMutationOptions = Exclude<
  Parameters<typeof api.topic.submitTopicFreeTextSuggestion.useMutation>[0],
  undefined
>;

const HELPFULNESS_RATING_GLYPHS: Record<HelpfulnessRating, string> = {
  really_helpful: "⇈",
  contributed_clarity: "↑",
  somewhat_useful: "·",
  passively_unhelpful: "↓",
  actively_unhelpful: "⇊",
};

const HELPFULNESS_RATING_HEADER_TITLES: Record<HelpfulnessRating, string> = {
  really_helpful: "Really helpful",
  contributed_clarity: "Contributed clarity",
  somewhat_useful: "Somewhat useful",
  passively_unhelpful: "Passively unhelpful",
  actively_unhelpful: "Actively unhelpful",
};

export function TopicDetail({
  topicId,
  onSelectTopic,
  className = "mx-auto max-w-3xl",
}: {
  topicId: number;
  /**
   * Signals "preview mode" (embedded without the topic list sidebar). When set,
   * the callback is invoked by related-topic chips instead of navigating; the
   * title becomes a link to `/topic/<id>`; and level controls render inline.
   */
  onSelectTopic?: (topicId: number) => void;
  className?: string;
}) {
  const id = topicId;
  const { data: topic, isLoading } = api.topic.getById.useQuery(
    { id },
    { enabled: !Number.isNaN(id) },
  );
  const { viewerUser } = useViewerAccess();
  const { data: statuses } = api.userStatus.getAll.useQuery(undefined, {
    enabled: !!viewerUser,
  });
  const { data: bookmarkedIds } = api.bookmark.getAll.useQuery(undefined, {
    enabled: !!viewerUser,
  });
  const { data: excitedToTeachIds } = api.excitedToTeach.getAll.useQuery(
    undefined,
    { enabled: !!viewerUser },
  );
  const topicLevelCounts = useLevelCounts().byTopic.get(id);
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
        if (context && "previous" in context) {
          utils.bookmark.getAll.setData(undefined, context.previous);
        }
      },
      refresh: [
        () => utils.bookmark.getAll.invalidate(),
        () => utils.match.invalidate(),
      ],
    },
  );
  // Preview mode (used inside the graph page) hides the topic list sidebar,
  // so we surface level + deep-link controls here to keep parity with the card.
  const isPreview = !!onSelectTopic;
  const { setStatus, removeStatus } = useTopicStatusMutations();
  const excitedToTeachSet = useAppMutation(
    (opts: ExcitedToTeachMutationOptions) =>
      api.excitedToTeach.set.useMutation(opts),
    {
      onMutate: async (vars) => {
        const input = vars as { topicId: number; excited: boolean };
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
      refresh: [
        () => utils.excitedToTeach.getAll.invalidate(),
        () => utils.topic.getTeachers.invalidate({ topicId: id }),
        () => utils.match.invalidate(),
      ],
    },
  );
  const { data: teachers } = api.topic.getTeachers.useQuery(
    { topicId: id },
    { enabled: !!viewerUser && !Number.isNaN(id) },
  );
  const serverLevel =
    topic && statuses
      ? statuses.find((s) => s.topicId === topic.id)?.level
      : undefined;
  const currentLevel = serverLevel;
  const hasResolvedViewerStatus = !!viewerUser && !!statuses;
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
      { topicId: id, level: currentLevel ?? null },
      { enabled: hasResolvedViewerStatus && !Number.isNaN(id) },
    );
  const { data: latestResourceFeedback } =
    api.feedback.getLatestResourceFeedbackByTopic.useQuery(
      { topicId: id },
      { enabled: hasResolvedViewerStatus && !Number.isNaN(id) },
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
    {},
  );
  const upsertManualFeedback = useAppMutation(
    (
      opts: Exclude<
        Parameters<typeof api.feedback.upsertFeedbackItem.useMutation>[0],
        undefined
      >,
    ) => api.feedback.upsertFeedbackItem.useMutation(opts),
    {
      onMutate: async (vars) => {
        const input = vars as ManualResourceUpsertInput;
        if (
          input.type !== "resource" ||
          input.helpfulnessRating === undefined
        ) {
          return;
        }

        const manualFeedbackInput = {
          topicId: input.topicId,
          level: currentLevel ?? null,
        };
        const latestResourceFeedbackInput = { topicId: input.topicId };
        await Promise.all([
          utils.topic.getById.cancel({ id: input.topicId }),
          utils.feedback.getManualFeedbackByTopic.cancel(manualFeedbackInput),
          utils.feedback.getLatestResourceFeedbackByTopic.cancel(
            latestResourceFeedbackInput,
          ),
        ]);

        const previousTopic = utils.topic.getById.getData({
          id: input.topicId,
        });
        const previousManualFeedback =
          utils.feedback.getManualFeedbackByTopic.getData(manualFeedbackInput);
        const previousLatestResourceFeedback =
          utils.feedback.getLatestResourceFeedbackByTopic.getData(
            latestResourceFeedbackInput,
          );
        const previousRating =
          previousLatestResourceFeedback?.find(
            (item) =>
              item.type === "resource" &&
              item.topicLinkId === input.topicLinkId,
          )?.helpfulnessRating ?? null;

        utils.topic.getById.setData({ id: input.topicId }, (old) => {
          if (!old) return old;
          return {
            ...old,
            topicLinks: old.topicLinks.map((link) => {
              if (link.id !== input.topicLinkId) return link;
              const ratingCounts = { ...link.ratingCounts };
              if (previousRating) {
                ratingCounts[previousRating] = Math.max(
                  0,
                  ratingCounts[previousRating] - 1,
                );
              }
              if (input.helpfulnessRating) {
                ratingCounts[input.helpfulnessRating] += 1;
              }
              return { ...link, ratingCounts };
            }),
          } satisfies TopicDetailData;
        });

        if (previousLatestResourceFeedback) {
          utils.feedback.getLatestResourceFeedbackByTopic.setData(
            latestResourceFeedbackInput,
            (old) => {
              if (!old) return old;
              const existing = old.find(
                (item) =>
                  item.type === "resource" &&
                  item.topicLinkId === input.topicLinkId,
              );
              if (existing) {
                return old.map((item) =>
                  item.type === "resource" &&
                  item.topicLinkId === input.topicLinkId
                    ? {
                        ...item,
                        helpfulnessRating: input.helpfulnessRating ?? null,
                      }
                    : item,
                );
              }
              if (input.helpfulnessRating == null) return old;
              return [
                ...old,
                {
                  id: input.id ?? -input.topicLinkId,
                  type: "resource" as const,
                  topicLinkId: input.topicLinkId,
                  helpfulnessRating: input.helpfulnessRating,
                  comment: null,
                },
              ];
            },
          );
        }

        if (previousManualFeedback) {
          utils.feedback.getManualFeedbackByTopic.setData(
            manualFeedbackInput,
            (old) => {
              if (!old) return old;
              if (old.transitionId === null) return old;
              return {
                ...old,
                feedbackItems: old.feedbackItems.map((item) =>
                  item.type === "resource" &&
                  item.topicLinkId === input.topicLinkId
                    ? {
                        ...item,
                        helpfulnessRating: input.helpfulnessRating ?? null,
                      }
                    : item,
                ),
              };
            },
          );
        }

        return {
          manualFeedbackInput,
          latestResourceFeedbackInput,
          previousTopic,
          previousManualFeedback,
          previousLatestResourceFeedback,
        };
      },
      onError: (error, _vars, ctx) => {
        const context = ctx as
          | {
              manualFeedbackInput: {
                topicId: number;
                level: UnderstandingLevel | null;
              };
              latestResourceFeedbackInput: { topicId: number };
              previousTopic?: TopicDetailData;
              previousManualFeedback?: ManualFeedbackData;
              previousLatestResourceFeedback?: LatestResourceFeedbackData;
            }
          | undefined;
        if (context) {
          utils.topic.getById.setData(
            { id: context.manualFeedbackInput.topicId },
            context.previousTopic,
          );
          utils.feedback.getManualFeedbackByTopic.setData(
            context.manualFeedbackInput,
            context.previousManualFeedback,
          );
          utils.feedback.getLatestResourceFeedbackByTopic.setData(
            context.latestResourceFeedbackInput,
            context.previousLatestResourceFeedback,
          );
        }
        showGlobalErrorToast(
          getErrorMessage(error, "Failed to save resource feedback."),
        );
      },
      refresh: [
        () => utils.feedback.getManualFeedbackByTopic.invalidate(),
        () => utils.feedback.getLatestResourceFeedbackByTopic.invalidate(),
      ],
    },
  );
  const canRateResources =
    hasResolvedViewerStatus &&
    manualFeedback !== undefined &&
    latestResourceFeedback !== undefined &&
    !ensureManualTransition.isPending &&
    !upsertManualFeedback.isPending;
  const showResourceFeedbackControls = !!viewerUser;
  const isBookmarked = topic ? (bookmarkedIds ?? []).includes(topic.id) : false;
  const isExcitedToTeach = topic
    ? (excitedToTeachIds ?? []).includes(topic.id)
    : false;

  // Un-starring is always allowed (cleans up stale records after a level downgrade);
  // only new excited-to-teach marks require a teacher level.
  const starDisabledReason =
    !isExcitedToTeach && !isTeacherLevel(currentLevel)
      ? "Set level to 'Can Teach' or higher to mark as excited to teach"
      : null;
  const isTopicLoading = !Number.isNaN(id) && isLoading;
  const isTopicMissing = !isTopicLoading && !topic;

  // Reset transient UI when navigating between topics (e.g. inside preview pane).
  useEffect(() => {
    setResourceSuggestionInput("");
    setResourceSuggestionMessage(null);
  }, [topicId]);

  return (
    <div className={className}>
      {isTopicLoading && <p className="text-zinc-500">Loading…</p>}

      {isTopicMissing && <p className="text-zinc-500">Topic not found</p>}

      {topic && (
        <>
          <div className="mb-2 flex items-center gap-3">
            {isPreview ? (
              <Link
                href={`/topic/${topic.id}`}
                title="Open topic page"
                className="block min-w-0"
              >
                <h1 className="bg-linear-60 from-orange-400 to-zinc-100 to-5% bg-clip-text text-3xl font-bold text-transparent hover:to-20% md:text-4xl">
                  {topic.name}
                </h1>
              </Link>
            ) : (
              <h1 className="bg-linear-60 from-orange-400 to-zinc-100 to-5% bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
                {topic.name}
              </h1>
            )}
            {viewerUser && (
              <div className="-mt-1 -mr-1.5 flex shrink-0 items-center">
                <TopicAffordanceIcon
                  variant="interactive"
                  kind="star"
                  filled={isExcitedToTeach}
                  onClick={() => {
                    if (excitedToTeachSet.isPending) return;
                    excitedToTeachSet.mutate({
                      topicId: topic.id,
                      excited: !isExcitedToTeach,
                    });
                  }}
                  disabled={!!starDisabledReason || excitedToTeachSet.isPending}
                  ariaLabel={
                    starDisabledReason ??
                    (isExcitedToTeach
                      ? "Remove excited to teach"
                      : "Mark excited to teach")
                  }
                  ariaPressed={isExcitedToTeach}
                  title={starDisabledReason ?? "Excited to teach"}
                />
                <TopicAffordanceIcon
                  variant="interactive"
                  kind="bookmark"
                  filled={isBookmarked}
                  onClick={() => {
                    if (bookmarkSet.isPending) return;
                    bookmarkSet.mutate({
                      topicId: topic.id,
                      bookmarked: !isBookmarked,
                    });
                  }}
                  disabled={bookmarkSet.isPending}
                  ariaLabel={
                    isBookmarked
                      ? "Remove bookmark"
                      : "I'd like to learn this topic"
                  }
                  ariaPressed={isBookmarked}
                  title="I'd like to learn this topic"
                />
              </div>
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

          {isPreview && viewerUser && (
            <div className="mb-4">
              <UnderstandingLevelCheckboxes
                currentLevel={currentLevel}
                isActive
                onLevelChange={(level) => {
                  if (level === undefined) {
                    removeStatus.mutate({ topicId: topic.id });
                  } else {
                    setStatus.mutate({ topicId: topic.id, level });
                  }
                }}
                counts={topicLevelCounts}
              />
            </div>
          )}

          {topic.description && (
            <div className="mb-4 space-y-3 text-zinc-400">
              {topic.description.split(/\n\n+/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}

          <div id="feedback" />
          {viewerUser && !Number.isNaN(id) && !isPreview && (
            <FeedbackSection topicId={id} topicLinks={topic.topicLinks ?? []} />
          )}

          {topic.topicLinks && topic.topicLinks.length > 0 && (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <h2 className="bg-clip-text text-lg font-semibold text-zinc-100">
                  Resources
                </h2>
                <div className="flex-1" />
                <div className="flex shrink-0 items-center gap-0.5 font-mono text-xs text-zinc-500">
                  {HELPFULNESS_RATINGS.map((r) => (
                    <span
                      key={r}
                      className="h-4 w-4 text-center leading-4"
                      title={HELPFULNESS_RATING_HEADER_TITLES[r]}
                    >
                      {HELPFULNESS_RATING_GLYPHS[r]}
                    </span>
                  ))}
                  {showResourceFeedbackControls && (
                    <span className="h-4 w-6" aria-hidden="true" />
                  )}
                </div>
              </div>
              {topic.guidance && (
                <p className="mb-3 text-sm text-zinc-400">{topic.guidance}</p>
              )}
              <ul className="space-y-2 text-sm">
                {topic.topicLinks.map((link) => (
                  <li key={link.id}>
                    <InlineRateableResource
                      link={link}
                      canRate={canRateResources}
                      showCommentControl={showResourceFeedbackControls}
                      manualFeedbackItems={manualFeedback?.feedbackItems ?? []}
                      latestResourceFeedbackItems={latestResourceFeedback ?? []}
                      onUpsert={async (input) => {
                        let transitionId = manualFeedback?.transitionId ?? null;
                        if (transitionId == null) {
                          const created =
                            await ensureManualTransition.mutateAsync({
                              topicId: id,
                              level: currentLevel ?? null,
                            });
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

          {viewerUser && teachers && teachers.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 bg-clip-text text-lg font-semibold text-zinc-100">
                People who can help
              </h2>
              <ul className="space-y-2">
                {teachers.map((t) => (
                  <li key={t.userId}>
                    <div className="flex items-center gap-2 text-sm text-zinc-300">
                      <span>{t.name ?? "Anonymous"}</span>
                      {t.excitedToTeach && (
                        <TopicAffordanceIcon
                          variant="read-only"
                          kind="star"
                          filled
                          title="Excited to teach"
                        />
                      )}
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                        {getLevelLabel(t.level)}
                      </span>
                      {t.available && (
                        <span className="rounded bg-orange-500/20 px-2 py-0.5 text-xs text-orange-400">
                          Available
                        </span>
                      )}
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
            {!viewerUser && (
              <p className="mb-2 text-sm text-zinc-500">
                Sign in to submit a resource for review.
              </p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add resource URL, person, or note..."
                value={resourceSuggestionInput}
                onChange={(e) => setResourceSuggestionInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const value = resourceSuggestionInput.trim();
                  if (
                    !viewerUser ||
                    !value ||
                    submitTopicSuggestion.isPending ||
                    Number.isNaN(id)
                  ) {
                    return;
                  }
                  submitTopicSuggestion.mutate({ topicId: id, value });
                }}
                disabled={!viewerUser}
                className="flex-1 rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                disabled={
                  !viewerUser ||
                  submitTopicSuggestion.isPending ||
                  !resourceSuggestionInput.trim()
                }
                onClick={() => {
                  const value = resourceSuggestionInput.trim();
                  if (
                    !viewerUser ||
                    !value ||
                    submitTopicSuggestion.isPending ||
                    Number.isNaN(id)
                  ) {
                    return;
                  }
                  submitTopicSuggestion.mutate({ topicId: id, value });
                }}
                className="rounded bg-orange-500/20 px-3 py-1.5 text-sm text-orange-400 hover:bg-orange-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add
              </button>
            </div>
          </section>

          {((topic.prerequisites && topic.prerequisites.length > 0) ||
            (topic.dependents && topic.dependents.length > 0)) && (
            <section className="mb-6">
              <h2 className="mb-3 text-lg font-semibold text-zinc-100">
                Related Topics
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {topic.prerequisites.map((p) => (
                  <RelatedTopicChip
                    key={`pre-${p.prerequisiteTopic.id}`}
                    topicId={p.prerequisiteTopic.id}
                    name={p.prerequisiteTopic.name}
                    onSelectTopic={onSelectTopic}
                  />
                ))}
                {topic.dependents.map((d) => (
                  <RelatedTopicChip
                    key={`dep-${d.topic.id}`}
                    topicId={d.topic.id}
                    name={d.topic.name}
                    onSelectTopic={onSelectTopic}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function RelatedTopicChip({
  topicId,
  name,
  onSelectTopic,
}: {
  topicId: number;
  name: string;
  onSelectTopic?: (topicId: number) => void;
}) {
  const chipClass =
    "rounded bg-zinc-800 px-2 py-0.5 text-sm text-orange-400 hover:bg-zinc-700 hover:text-orange-300";
  if (onSelectTopic) {
    return (
      <button
        type="button"
        onClick={() => onSelectTopic(topicId)}
        className={chipClass}
      >
        {name}
      </button>
    );
  }
  return (
    <Link href={`/topic/${topicId}`} className={chipClass}>
      {name}
    </Link>
  );
}

type ManualFeedbackItem =
  RouterOutputs["feedback"]["getManualFeedbackByTopic"]["feedbackItems"][number];
type ManualFeedbackData = RouterOutputs["feedback"]["getManualFeedbackByTopic"];
type LatestResourceFeedbackData =
  RouterOutputs["feedback"]["getLatestResourceFeedbackByTopic"];
type TopicDetailData = NonNullable<RouterOutputs["topic"]["getById"]>;

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
  canRate,
  showCommentControl,
  manualFeedbackItems,
  latestResourceFeedbackItems,
  onUpsert,
}: {
  link: {
    id: number;
    title: string;
    url: string | null;
    comment: string | null;
    ratingCounts: Record<HelpfulnessRating, number>;
  };
  canRate: boolean;
  showCommentControl: boolean;
  manualFeedbackItems: ManualFeedbackItem[];
  latestResourceFeedbackItems: LatestResourceFeedbackData;
  onUpsert: (
    input: Omit<ManualResourceUpsertInput, "topicId" | "transitionId">,
  ) => Promise<void>;
}) {
  const manualExisting = manualFeedbackItems.find(
    (fi) => fi.type === "resource" && fi.topicLinkId === link.id,
  );
  const latestExisting = latestResourceFeedbackItems.find(
    (fi) => fi.type === "resource" && fi.topicLinkId === link.id,
  );
  const [showComment, setShowComment] = useState(false);
  const [rating, setRating] = useState<HelpfulnessRating | null>(null);
  const [comment, setComment] = useState("");
  const [hasLocalEdits, setHasLocalEdits] = useState(false);
  const existingRating = latestExisting?.helpfulnessRating ?? null;
  const existingComment = latestExisting?.comment ?? "";

  useEffect(() => {
    if (hasLocalEdits) return;
    setRating(existingRating);
    setComment(existingComment);
  }, [existingRating, existingComment, hasLocalEdits]);

  useEffect(() => {
    if (
      hasLocalEdits &&
      rating === existingRating &&
      comment === existingComment
    ) {
      setHasLocalEdits(false);
    }
  }, [comment, existingComment, existingRating, hasLocalEdits, rating]);

  const hasComment = comment.trim().length > 0;

  const doUpsert = async (patch: {
    helpfulnessRating?: HelpfulnessRating | null;
    comment?: string | null;
  }) => {
    await onUpsert({
      id: manualExisting?.id,
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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{linkEl}</div>
        <div className="ml-auto flex shrink-0 items-center gap-0.5 font-mono text-xs">
          {HELPFULNESS_RATINGS.map((r) => {
            const count = link.ratingCounts[r];
            const isSelected = rating === r;
            const baseClass =
              "h-4 w-4 rounded border bg-transparent text-center leading-3.5 tabular-nums transition";
            const selectedClass = "border-orange-500 text-orange-300";
            const countClass =
              count === 0
                ? "border-transparent text-zinc-700"
                : "border-transparent text-zinc-500";
            const interactiveClass =
              "hover:border-zinc-700 hover:text-zinc-300 focus-visible:border-zinc-700 focus-visible:ring-1 focus-visible:ring-orange-500/40 focus-visible:outline-none";
            const className = `${baseClass} ${
              isSelected
                ? selectedClass
                : canRate
                  ? `${countClass} ${interactiveClass}`
                  : countClass
            }`;

            if (!canRate) {
              return (
                <span
                  key={r}
                  className={className}
                  title={HELPFULNESS_RATING_HEADER_TITLES[r]}
                >
                  {count}
                </span>
              );
            }

            return (
              <button
                key={r}
                type="button"
                onClick={() => {
                  const next = isSelected ? null : r;
                  setHasLocalEdits(true);
                  setRating(next);
                  void doUpsert({ helpfulnessRating: next });
                }}
                className={className}
                title={HELPFULNESS_RATING_HEADER_TITLES[r]}
                aria-label={`Set resource rating: ${HELPFULNESS_RATING_HEADER_TITLES[r]}`}
                aria-pressed={isSelected}
              >
                {count}
              </button>
            );
          })}
          {showCommentControl && (
            <button
              type="button"
              onClick={() => {
                if (!canRate) return;
                setShowComment((v) => !v);
              }}
              className={`w-6 shrink-0 rounded p-1 transition focus-visible:ring-1 focus-visible:ring-orange-500/40 focus-visible:outline-none ${
                hasComment
                  ? "text-orange-500 hover:bg-zinc-700/60"
                  : canRate
                    ? "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    : "text-zinc-500"
              }`}
              title={hasComment ? "Show comment" : "Add comment"}
              aria-disabled={!canRate}
            >
              <CommentIcon filled={hasComment} />
            </button>
          )}
        </div>
      </div>
      {link.comment && (
        <p className="text-xs text-zinc-500 italic">{link.comment}</p>
      )}
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
