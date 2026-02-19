import { useEffect, useMemo, useRef, useState } from "react";

import {
  HELPFULNESS_RATING_LABELS,
  HELPFULNESS_RATINGS,
  type HelpfulnessRating,
} from "~/shared/feedbackTypes";
import { getLevelLabel } from "~/shared/understandingLevels";
import { api, type RouterOutputs } from "~/utils/api";

type Transition = RouterOutputs["feedback"]["getTransitionsByTopic"][number];

type ExistingFeedbackItem = Transition["feedbackItems"][number];

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
};

export function FeedbackSection({ topicId }: { topicId: number }) {
  const { data: transitions } = api.feedback.getTransitionsByTopic.useQuery({
    topicId,
  });
  const { data: topic } = api.topic.getById.useQuery({ id: topicId });
  const { data: teachers } = api.topic.getTeachers.useQuery(
    { topicId },
    { enabled: !!transitions && transitions.length > 0 },
  );

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (transitions?.[0]) {
      setExpandedIds((prev) => {
        if (prev.size === 0) return new Set([transitions[0]!.id]);
        return prev;
      });
    }
  }, [transitions]);

  const utils = api.useUtils();

  const upsertMutation = api.feedback.upsertFeedbackItem.useMutation({
    onSuccess: () => {
      void utils.feedback.getTransitionsByTopic.invalidate({ topicId });
      void utils.feedback.getRecentTransitions.invalidate();
    },
  });

  const deleteMutation = api.feedback.deleteFeedbackItem.useMutation({
    onSuccess: () => {
      void utils.feedback.getTransitionsByTopic.invalidate({ topicId });
      void utils.feedback.getRecentTransitions.invalidate();
    },
  });
  const promoteMutation = api.feedback.promoteFreeTextToTopicLink.useMutation({
    onSuccess: () => {
      void utils.feedback.getTransitionsByTopic.invalidate({ topicId });
      void utils.feedback.getRecentTransitions.invalidate();
      void utils.topic.getById.invalidate({ id: topicId });
    },
  });

  if (!transitions || transitions.length === 0) return null;

  const toggle = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-semibold text-zinc-100">
        Learning feedback
      </h2>
      <div className="space-y-3">
        {transitions.map((t, idx) => (
          <TransitionAccordion
            key={t.id}
            transition={t}
            isLatest={idx === 0}
            isExpanded={expandedIds.has(t.id)}
            onToggle={() => toggle(t.id)}
            topicLinks={topic?.topicLinks ?? []}
            teachers={teachers ?? []}
            onUpsert={(input) => upsertMutation.mutate(input)}
            onDelete={(id) => deleteMutation.mutate({ id })}
            onPromote={(feedbackItemId) =>
              promoteMutation.mutate({ feedbackItemId })
            }
          />
        ))}
      </div>
    </section>
  );
}

type TopicLink = { id: number; title: string; url: string | null };
type Teacher = { userId: string; name: string | null; level: string };

function buildUnifiedItems(
  transition: Transition,
  topicLinks: TopicLink[],
  teachers: Teacher[],
  isLatest: boolean,
): UnifiedItem[] {
  const items: UnifiedItem[] = [];

  // Index existing feedback items by their reference
  const byResourceId = new Map<number, ExistingFeedbackItem>();
  const byUserId = new Map<string, ExistingFeedbackItem>();
  const freeTextItems: ExistingFeedbackItem[] = [];

  for (const fi of transition.feedbackItems) {
    if (fi.type === "resource" && fi.topicLinkId != null) {
      byResourceId.set(fi.topicLinkId, fi);
    } else if (fi.type === "user" && fi.referencedUserId != null) {
      byUserId.set(fi.referencedUserId, fi);
    } else if (fi.type === "free_text") {
      freeTextItems.push(fi);
    }
  }

  if (isLatest) {
    // Latest transition shows all suggestions so users can fill them quickly.
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
  } else {
    // Historical transitions should only render saved data, unchanged over time.
    for (const fi of transition.feedbackItems) {
      if (fi.type === "resource") {
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
      } else if (fi.type === "user") {
        items.push({
          key: `user-existing-${fi.id}`,
          existingId: fi.id,
          type: "user",
          label:
            fi.referencedUser?.name ?? fi.referencedUser?.email ?? "Person",
          referencedUserId: fi.referencedUserId ?? undefined,
          helpfulnessRating: fi.helpfulnessRating ?? null,
          comment: fi.comment ?? null,
          deletable: false,
        });
      }
    }
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

  return items;
}

function TransitionAccordion({
  transition,
  isLatest,
  isExpanded,
  onToggle,
  topicLinks,
  teachers,
  onUpsert,
  onDelete,
  onPromote,
}: {
  transition: Transition;
  isLatest: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  topicLinks: TopicLink[];
  teachers: Teacher[];
  onUpsert: (input: {
    id?: number;
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
}) {
  const [newFreeText, setNewFreeText] = useState("");

  const unifiedItems = useMemo(
    () => buildUnifiedItems(transition, topicLinks, teachers, isLatest),
    [transition, topicLinks, teachers, isLatest],
  );

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-zinc-800/80"
      >
        <div className="flex-1">
          <div className="text-sm text-zinc-300">
            {transition.fromLevel ? getLevelLabel(transition.fromLevel) : "-"}
            {" -> "}
            {transition.toLevel ? getLevelLabel(transition.toLevel) : "-"}
          </div>
          <div className="text-xs text-zinc-500">
            {new Date(transition.createdAt).toLocaleDateString()}
          </div>
        </div>
        <span className="text-zinc-500">{isExpanded ? "▼" : "▶"}</span>
      </button>

      {isExpanded && (
        <div className="space-y-4 border-t border-zinc-700 p-4">
          {unifiedItems.map((item) => (
            <UnifiedItemRow
              key={item.key}
              item={item}
              onUpdate={(patch) =>
                onUpsert({
                  id: item.existingId,
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

          {isLatest && (
            <div className="flex gap-2 border-t border-zinc-700 pt-4">
              <input
                type="text"
                placeholder="Add resource URL, person, or note..."
                value={newFreeText}
                onChange={(e) => setNewFreeText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const value = newFreeText.trim();
                    if (value) {
                      onUpsert({
                        transitionId: transition.id,
                        type: "free_text",
                        freeTextValue: value,
                        helpfulnessRating: null,
                      });
                      setNewFreeText("");
                    }
                  }
                }}
                className="flex-1 rounded border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const value = newFreeText.trim();
                  if (value) {
                    onUpsert({
                      transitionId: transition.id,
                      type: "free_text",
                      freeTextValue: value,
                      helpfulnessRating: null,
                    });
                    setNewFreeText("");
                  }
                }}
                className="rounded bg-orange-500/20 px-4 py-2 text-sm text-orange-400 hover:bg-orange-500/30"
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UnifiedItemRow({
  item,
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
  const [showComment, setShowComment] = useState(!!item.comment);
  const [rating, setRating] = useState<HelpfulnessRating | null>(
    item.helpfulnessRating,
  );
  const [comment, setComment] = useState(item.comment ?? "");

  useEffect(() => {
    setRating(item.helpfulnessRating);
  }, [item.helpfulnessRating]);

  useEffect(() => {
    setComment(item.comment ?? "");
  }, [item.comment]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 text-sm text-zinc-300">
          {item.linkUrl ? (
            <a
              href={item.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 underline decoration-orange-400/30 underline-offset-2 hover:text-orange-300"
            >
              {item.label}
            </a>
          ) : (
            <span>{item.label}</span>
          )}
        </div>
        <HelpfulnessSelect
          value={rating}
          onChange={(nextRating) => {
            setRating(nextRating);
            onUpdate({ helpfulnessRating: nextRating });
          }}
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setShowComment((v) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-300"
            title="Add comment"
          >
            {showComment ? "Hide" : "Comment"}
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

function HelpfulnessSelect({
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

function DebouncedTextarea({
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
