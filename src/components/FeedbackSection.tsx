import { useEffect, useMemo, useRef, useState } from "react";

import {
  HELPFULNESS_RATING_LABELS,
  HELPFULNESS_RATINGS,
  SKIP_FEEDBACK_SENTINEL,
  type HelpfulnessRating,
} from "~/shared/feedbackTypes";
import { useAppMutation } from "~/hooks/useAppMutation";
import { getLevelLabel } from "~/shared/understandingLevels";
import { api, type RouterOutputs } from "~/utils/api";
import { CommentIcon } from "~/components/CommentIcon";

type Transition = RouterOutputs["feedback"]["getTransitionsByTopic"][number];

type ExistingFeedbackItem = Transition["feedbackItems"][number];
type UpsertFeedbackMutationOptions = Exclude<
  Parameters<typeof api.feedback.upsertFeedbackItem.useMutation>[0],
  undefined
>;
type DeleteFeedbackMutationOptions = Exclude<
  Parameters<typeof api.feedback.deleteFeedbackItem.useMutation>[0],
  undefined
>;
type PromoteFeedbackMutationOptions = Exclude<
  Parameters<typeof api.feedback.promoteFreeTextToTopicLink.useMutation>[0],
  undefined
>;
type SkipTransitionFeedbackMutationOptions = Exclude<
  Parameters<typeof api.feedback.skipTransitionFeedback.useMutation>[0],
  undefined
>;

type UnifiedItem = {
  key: string;
  existingId?: number;
  type: "resource" | "user" | "free_text";
  label: string;
  linkUrl?: string | null;
  topicLinkId?: number;
  referencedUserId?: string;
  freeTextValue?: string;
  helpfulnessRating: HelpfulnessRating | null;
  comment: string | null;
  deletable: boolean;
  canPromoteToResource?: boolean;
  isSkipPlaceholder?: boolean;
};

type TopicLink = { id: number; title: string; url: string | null };

function getMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

export function FeedbackSection({
  topicId,
  topicLinks,
}: {
  topicId: number;
  topicLinks: TopicLink[];
}) {
  const { data: transitions } = api.feedback.getTransitionsByTopic.useQuery({
    topicId,
  });
  const { data: teachers } = api.topic.getTeachers.useQuery(
    { topicId },
    { enabled: !!transitions && transitions.length > 0 },
  );

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const hasInitializedExpansion = useRef(false);

  useEffect(() => {
    hasInitializedExpansion.current = false;
    setExpandedIds(new Set());
  }, [topicId]);

  useEffect(() => {
    if (!transitions || hasInitializedExpansion.current) return;
    // On initial load per topic, auto-expand only transitions still pending feedback.
    const pendingTransitionIds = transitions
      .filter((transition) => transition.feedbackItems.length === 0)
      .map((transition) => transition.id);
    setExpandedIds(new Set(pendingTransitionIds));
    hasInitializedExpansion.current = true;
  }, [transitions]);

  const utils = api.useUtils();
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const upsertMutation = useAppMutation(
    (opts: UpsertFeedbackMutationOptions) =>
      api.feedback.upsertFeedbackItem.useMutation(opts),
    {
      onSuccess: () => {
        setFeedbackError(null);
      },
      onError: (error) => {
        setFeedbackError(
          getMutationErrorMessage(error, "Failed to save feedback item."),
        );
      },
      refresh: [
        () => utils.feedback.getTransitionsByTopic.invalidate({ topicId }),
        () => utils.feedback.getRecentTransitions.invalidate(),
      ],
    },
  );

  const deleteMutation = useAppMutation(
    (opts: DeleteFeedbackMutationOptions) =>
      api.feedback.deleteFeedbackItem.useMutation(opts),
    {
      onSuccess: () => {
        setFeedbackError(null);
      },
      onError: (error) => {
        setFeedbackError(
          getMutationErrorMessage(error, "Failed to delete feedback item."),
        );
      },
      refresh: [
        () => utils.feedback.getTransitionsByTopic.invalidate({ topicId }),
        () => utils.feedback.getRecentTransitions.invalidate(),
      ],
    },
  );
  const promoteMutation = useAppMutation(
    (opts: PromoteFeedbackMutationOptions) =>
      api.feedback.promoteFreeTextToTopicLink.useMutation(opts),
    {
      onSuccess: () => {
        setFeedbackError(null);
      },
      onError: (error) => {
        setFeedbackError(
          getMutationErrorMessage(
            error,
            "Failed to promote this item to a topic resource.",
          ),
        );
      },
      refresh: [
        () => utils.feedback.getTransitionsByTopic.invalidate({ topicId }),
        () => utils.feedback.getRecentTransitions.invalidate(),
        () => utils.topic.getById.invalidate({ id: topicId }),
      ],
    },
  );
  const skipTransitionMutation = useAppMutation(
    (opts: SkipTransitionFeedbackMutationOptions) =>
      api.feedback.skipTransitionFeedback.useMutation(opts),
    {
      onSuccess: () => {
        setFeedbackError(null);
      },
      onError: (error) => {
        setFeedbackError(
          getMutationErrorMessage(error, "Failed to skip feedback."),
        );
      },
      refresh: [
        () => utils.feedback.getTransitionsByTopic.invalidate({ topicId }),
        () => utils.feedback.getRecentTransitions.invalidate(),
      ],
    },
  );

  if (!transitions || transitions.length === 0) return null;

  const toggle = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-zinc-100">
        Learning feedback
      </h2>
      {feedbackError && (
        <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {feedbackError}
        </p>
      )}
      <div className="space-y-3">
        {transitions.map((t) => (
          <TransitionAccordion
            key={t.id}
            transition={t}
            isExpanded={expandedIds.has(t.id)}
            onToggle={() => toggle(t.id)}
            topicLinks={topicLinks}
            teachers={teachers ?? []}
            onUpsert={(input) => upsertMutation.mutate(input)}
            onDelete={(id) => deleteMutation.mutate({ id })}
            onPromote={(feedbackItemId) =>
              promoteMutation.mutate({ feedbackItemId })
            }
            onSkip={() => skipTransitionMutation.mutate({ transitionId: t.id })}
          />
        ))}
      </div>
    </section>
  );
}

type Teacher = { userId: string; name: string | null; level: string };

function buildUnifiedItems(
  transition: Transition,
  topicLinks: TopicLink[],
  teachers: Teacher[],
): UnifiedItem[] {
  const items: UnifiedItem[] = [];

  // Index existing feedback items by their reference
  const byResourceId = new Map<number, ExistingFeedbackItem>();
  const byUserId = new Map<string, ExistingFeedbackItem>();
  const freeTextItems: ExistingFeedbackItem[] = [];
  const skipPlaceholderItems: ExistingFeedbackItem[] = [];

  for (const fi of transition.feedbackItems) {
    const isLegacySkipPlaceholder =
      fi.type === "resource" &&
      fi.topicLinkId == null &&
      fi.referencedUserId == null &&
      fi.freeTextValue == null &&
      fi.helpfulnessRating == null &&
      (fi.comment == null || fi.comment.trim().length === 0);
    const isSentinelSkipPlaceholder =
      fi.type === "free_text" && fi.freeTextValue === SKIP_FEEDBACK_SENTINEL;
    if (isLegacySkipPlaceholder || isSentinelSkipPlaceholder) {
      skipPlaceholderItems.push(fi);
      continue;
    }

    if (fi.type === "resource" && fi.topicLinkId != null) {
      byResourceId.set(fi.topicLinkId, fi);
    } else if (fi.type === "user" && fi.referencedUserId != null) {
      byUserId.set(fi.referencedUserId, fi);
    } else if (fi.type === "free_text") {
      freeTextItems.push(fi);
    }
  }

  // Every transition can be edited, including historical ones.
  for (const link of topicLinks) {
    const existing = byResourceId.get(link.id);
    items.push({
      key: `resource-${link.id}`,
      existingId: existing?.id,
      type: "resource",
      label: link.title,
      linkUrl: link.url,
      topicLinkId: link.id,
      helpfulnessRating: existing?.helpfulnessRating ?? null,
      comment: existing?.comment ?? null,
      deletable: false,
    });
    byResourceId.delete(link.id);
  }

  for (const teacher of teachers) {
    const existing = byUserId.get(teacher.userId);
    items.push({
      key: `user-${teacher.userId}`,
      existingId: existing?.id,
      type: "user",
      label: teacher.name ?? "Anonymous",
      referencedUserId: teacher.userId,
      helpfulnessRating: existing?.helpfulnessRating ?? null,
      comment: existing?.comment ?? null,
      deletable: false,
    });
    byUserId.delete(teacher.userId);
  }

  // Keep already-saved items visible even if current suggestions no longer include them.
  for (const fi of byResourceId.values()) {
    items.push({
      key: `resource-existing-${fi.id}`,
      existingId: fi.id,
      type: "resource",
      label: fi.topicLink?.title ?? "Resource",
      linkUrl: fi.topicLink?.url ?? null,
      topicLinkId: fi.topicLinkId ?? undefined,
      helpfulnessRating: fi.helpfulnessRating ?? null,
      comment: fi.comment ?? null,
      deletable: false,
    });
  }
  for (const fi of byUserId.values()) {
    items.push({
      key: `user-existing-${fi.id}`,
      existingId: fi.id,
      type: "user",
      label: fi.referencedUser?.name ?? fi.referencedUser?.email ?? "Person",
      referencedUserId: fi.referencedUserId ?? undefined,
      helpfulnessRating: fi.helpfulnessRating ?? null,
      comment: fi.comment ?? null,
      deletable: false,
    });
  }

  for (const fi of freeTextItems) {
    items.push({
      key: `free-${fi.id}`,
      existingId: fi.id,
      type: "free_text",
      label: fi.freeTextValue ?? "",
      freeTextValue: fi.freeTextValue ?? undefined,
      helpfulnessRating: fi.helpfulnessRating ?? null,
      comment: fi.comment ?? null,
      deletable: true,
      canPromoteToResource: /^https?:\/\//i.test(fi.freeTextValue ?? ""),
    });
  }
  for (const fi of skipPlaceholderItems) {
    items.push({
      key: `skip-${fi.id}`,
      existingId: fi.id,
      type: "free_text",
      label: "Skipped for now",
      freeTextValue: SKIP_FEEDBACK_SENTINEL,
      helpfulnessRating: null,
      comment: null,
      deletable: true,
      isSkipPlaceholder: true,
    });
  }

  return items;
}

function TransitionAccordion({
  transition,
  isExpanded,
  onToggle,
  topicLinks,
  teachers,
  onUpsert,
  onDelete,
  onPromote,
  onSkip,
}: {
  transition: Transition;
  isExpanded: boolean;
  onToggle: () => void;
  topicLinks: TopicLink[];
  teachers: Teacher[];
  onUpsert: (input: {
    id?: number;
    topicId: number;
    transitionId: number;
    type: "resource" | "user" | "free_text";
    topicLinkId?: number | null;
    referencedUserId?: string | null;
    freeTextValue?: string | null;
    helpfulnessRating?: HelpfulnessRating | null;
    comment?: string | null;
  }) => void;
  onDelete: (id: number) => void;
  onPromote: (feedbackItemId: number) => void;
  onSkip: () => void;
}) {
  const unifiedItems = useMemo(
    () => buildUnifiedItems(transition, topicLinks, teachers),
    [transition, topicLinks, teachers],
  );
  const isDone = transition.feedbackItems.length > 0;

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-zinc-800/50 ${
        isDone ? "border-zinc-700" : "border-orange-500"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-2 text-left hover:bg-zinc-800/80 lg:p-4"
      >
        <div className="flex-1">
          <div className="text-sm text-zinc-300">
            {transition.fromLevel ? getLevelLabel(transition.fromLevel) : "-"}
            {" -> "}
            {transition.toLevel ? getLevelLabel(transition.toLevel) : "-"}
          </div>
          <div className="text-xs text-zinc-500">
            {transition.createdAt.toLocaleString("sv-SE")}
          </div>
        </div>
        <div className="ml-3 flex items-center gap-2">
          {isDone && <span className="text-sm text-emerald-400">✓</span>}
          <span className="text-zinc-500">{isExpanded ? "▼" : "▶"}</span>
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-3 border-t border-zinc-700 p-2 lg:p-4">
          {unifiedItems.map((item) => (
            <UnifiedItemRow
              key={item.key}
              item={item}
              onUpdate={(patch) =>
                onUpsert({
                  id: item.existingId,
                  topicId: transition.topicId,
                  transitionId: transition.id,
                  type: item.type,
                  topicLinkId: item.topicLinkId ?? null,
                  referencedUserId: item.referencedUserId ?? null,
                  freeTextValue: item.freeTextValue ?? null,
                  ...patch,
                })
              }
              onDelete={
                item.deletable && item.existingId
                  ? () => onDelete(item.existingId!)
                  : undefined
              }
              onPromote={
                item.canPromoteToResource && item.existingId
                  ? () => onPromote(item.existingId!)
                  : undefined
              }
            />
          ))}
          {!isDone && (
            <div className="border-t border-zinc-700 pt-2 lg:pt-4">
              <button
                type="button"
                onClick={onSkip}
                className="text-sm text-zinc-500 underline decoration-zinc-600 underline-offset-2 hover:text-zinc-300"
              >
                Skip
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UnifiedItemRow({
  item: initialItem,
  onUpdate,
  onDelete,
  onPromote,
}: {
  item: UnifiedItem;
  onUpdate: (patch: {
    helpfulnessRating?: HelpfulnessRating | null;
    comment?: string | null;
  }) => void;
  onDelete?: () => void;
  onPromote?: () => void;
}) {
  // Local draft is authoritative once the user starts editing this row.
  // We intentionally do not resync from server props to avoid clobbering input.
  const [showComment, setShowComment] = useState(!!initialItem.comment);
  const [rating, setRating] = useState<HelpfulnessRating | null>(
    initialItem.helpfulnessRating,
  );
  const [comment, setComment] = useState(initialItem.comment ?? "");
  const hasComment = comment.trim().length > 0;
  const commentTooltip = showComment
    ? "Hide comment"
    : hasComment
      ? "Show comment"
      : "Add comment";

  if (initialItem.isSkipPlaceholder) {
    return (
      <div className="flex items-center justify-between gap-2 rounded border border-zinc-700/80 bg-zinc-900/40 px-2 py-1.5">
        <span className="text-sm text-zinc-400">{initialItem.label}</span>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs text-zinc-500 hover:text-red-400"
            title="Undo skip"
          >
            Undo skip
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 text-sm text-zinc-300">
          {initialItem.linkUrl ? (
            <a
              href={initialItem.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate whitespace-nowrap text-orange-400 underline decoration-orange-400/30 underline-offset-2 hover:text-orange-300"
            >
              {initialItem.label}
            </a>
          ) : (
            <span className="block truncate whitespace-nowrap">
              {initialItem.label}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <HelpfulnessSelect
            value={rating}
            onChange={(nextRating) => {
              setRating(nextRating);
              onUpdate({ helpfulnessRating: nextRating });
            }}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowComment((v) => !v)}
              className={`w-6 shrink-0 rounded p-1 transition ${
                hasComment
                  ? "text-orange-300 hover:bg-zinc-700/60"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
              title={commentTooltip}
            >
              <CommentIcon filled={hasComment} />
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="text-xs text-zinc-500 hover:text-red-400"
                title="Remove"
              >
                Remove
              </button>
            )}
            {onPromote && (
              <button
                type="button"
                onClick={onPromote}
                className="text-xs text-zinc-500 hover:text-orange-300"
                title="Add this link as a topic resource"
              >
                Promote
              </button>
            )}
          </div>
        </div>
      </div>
      {showComment && (
        <DebouncedTextarea
          initialValue={comment}
          onLocalChange={setComment}
          onSave={(nextComment) => onUpdate({ comment: nextComment || null })}
          placeholder="Optional comment..."
        />
      )}
    </div>
  );
}

export function HelpfulnessSelect({
  value,
  onChange,
}: {
  value: HelpfulnessRating | null;
  onChange: (rating: HelpfulnessRating | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => {
        const val = e.target.value;
        onChange(val ? (val as HelpfulnessRating) : null);
      }}
      className="shrink-0 rounded border border-zinc-600 bg-zinc-800 px-2 py-1 font-sans text-xs text-zinc-100 focus:border-orange-500/50 focus:outline-none"
    >
      <option value="">Rate...</option>
      {HELPFULNESS_RATINGS.map((r) => (
        <option key={r} value={r}>
          {HELPFULNESS_RATING_LABELS[r]}
        </option>
      ))}
    </select>
  );
}

export function DebouncedTextarea({
  initialValue,
  onLocalChange,
  onSave,
  placeholder,
}: {
  initialValue: string;
  onLocalChange?: (value: string) => void;
  onSave: (value: string) => void;
  placeholder?: string;
}) {
  const [value, setValue] = useState(initialValue);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return (
    <textarea
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next);
        onLocalChange?.(next);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          onSaveRef.current(next);
        }, 500);
      }}
      onBlur={() => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        onSaveRef.current(value);
      }}
      rows={2}
      placeholder={placeholder}
      className="w-full rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
    />
  );
}
