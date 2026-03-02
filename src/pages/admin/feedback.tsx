import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

import {
  HELPFULNESS_RATING_LABELS,
  SKIP_FEEDBACK_SENTINEL,
} from "~/shared/feedbackTypes";
import {
  getLevelLabel,
  getLevelShortLabel,
  type UnderstandingLevel,
  UNDERSTANDING_LEVEL_LABELS,
} from "~/shared/understandingLevels";
import { AuthHeader } from "~/components/AuthHeader";
import { authClient } from "~/server/better-auth/client";
import { api, type RouterOutputs } from "~/utils/api";

const ADMIN_FEEDBACK_SIDEBAR_COLLAPSED_KEY =
  "affine.admin-feedback.sidebar-collapsed";

type TopicStats = RouterOutputs["admin"]["adminFeedbackTopicStats"][number];
type Transition = RouterOutputs["admin"]["adminFeedbackByTopic"][number];
type FeedbackItem = Transition["feedbackItems"][number];

function LevelStatBox({
  level,
  userCount,
  transitionsIn,
  transitionsOut,
}: {
  level: UnderstandingLevel;
  userCount: number;
  transitionsIn: number;
  transitionsOut: number;
}) {
  const fullLabel = UNDERSTANDING_LEVEL_LABELS[level];
  const shortLabel = getLevelShortLabel(level);
  const tooltip = `"${fullLabel}": ${userCount} users now; ${transitionsIn} transitions in (↘); ${transitionsOut} transitions out (↗).`;
  return (
    <div
      className="flex flex-col gap-0.5 rounded border border-zinc-700 bg-zinc-800/60 px-1.5 py-0.5 text-xs text-zinc-300 tabular-nums"
      title={tooltip}
    >
      <span className="hidden text-[10px] text-zinc-500 lg:block">
        {shortLabel}
      </span>
      <div className="flex items-center gap-0.5 text-xs">
        <span className="flex items-center gap-0.5">
          <ArrowInIcon className="h-3 w-3 text-zinc-500" aria-hidden />
          {transitionsIn}
        </span>
        <span className="min-w-5 text-center">{userCount}</span>
        <span className="flex items-center gap-0.5">
          {transitionsOut}
          <ArrowOutIcon className="h-3 w-3 text-zinc-500" aria-hidden />
        </span>
      </div>
    </div>
  );
}

function ArrowInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden>
      <path
        d="M2 2L10 10M10 10H4M10 10V4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowOutIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} aria-hidden>
      <path
        d="M2 10L10 2M10 2H4M10 2V8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AdminTopicRow({
  topic: t,
  isSelected,
  onSelect,
}: {
  topic: TopicStats;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg px-2 py-2 text-left transition ${
        isSelected
          ? "bg-orange-500/20 text-orange-200 ring-1 ring-orange-500/40"
          : "text-zinc-200 hover:bg-zinc-800/80"
      }`}
    >
      <div className="text-sm font-medium">{t.name}</div>
      {t.hasActivity ? (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {(
            Object.entries(t.levels) as [
              UnderstandingLevel,
              TopicStats["levels"][UnderstandingLevel],
            ][]
          ).map(([level, stats]) => (
            <LevelStatBox
              key={level}
              level={level}
              userCount={stats.userCount}
              transitionsIn={stats.transitionsIn}
              transitionsOut={stats.transitionsOut}
            />
          ))}
        </div>
      ) : (
        <div className="mt-1 text-xs text-zinc-500">no ratings yet</div>
      )}
    </button>
  );
}

function hasRatedFeedback(item: FeedbackItem): boolean {
  if (item.freeTextValue === SKIP_FEEDBACK_SENTINEL) return false;
  return (
    item.helpfulnessRating != null ||
    (item.comment != null && item.comment.trim().length > 0)
  );
}

function getItemLabel(item: FeedbackItem): string {
  if (item.topicLink) return item.topicLink.title;
  if (item.referencedUser)
    return item.referencedUser.name ?? item.referencedUser.email ?? "Person";
  return item.freeTextValue?.trim() ?? "—";
}

function getItemUrl(item: FeedbackItem): string | null {
  return item.topicLink?.url ?? null;
}

function AdminFeedbackItemRow({ item }: { item: FeedbackItem }) {
  const label = getItemLabel(item);
  const url = getItemUrl(item);
  const ratingLabel =
    item.helpfulnessRating &&
    item.helpfulnessRating in HELPFULNESS_RATING_LABELS
      ? HELPFULNESS_RATING_LABELS[item.helpfulnessRating]
      : null;
  const hasComment = item.comment != null && item.comment.trim().length > 0;
  return (
    <div className="space-y-0.5 rounded border border-zinc-700/80 bg-zinc-900/40 px-2 py-1">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 underline decoration-orange-400/30 underline-offset-2 hover:text-orange-300"
          >
            {label}
          </a>
        ) : (
          <span className="text-zinc-300">{label}</span>
        )}
        <span
          className={ratingLabel ? "text-zinc-400" : "text-zinc-500 italic"}
        >
          {ratingLabel ?? "no rating"}
        </span>
      </div>
      {hasComment && (
        <p className="text-xs whitespace-pre-wrap text-zinc-400">
          {item.comment!.trim()}
        </p>
      )}
    </div>
  );
}

function AdminTransitionAccordion({
  transition,
  isExpanded,
  onToggle,
}: {
  transition: Transition;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const ratedItems = transition.feedbackItems.filter(hasRatedFeedback);
  const userName = transition.user.name ?? transition.user.email ?? "Anonymous";
  const transitionLabel = [
    transition.fromLevel ? getLevelLabel(transition.fromLevel) : "-",
    " → ",
    transition.toLevel ? getLevelLabel(transition.toLevel) : "-",
  ].join("");
  const timestamp = transition.createdAt.toLocaleString("sv-SE");
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left hover:bg-zinc-800/80 lg:px-3 lg:py-2"
      >
        <div className="min-w-0 flex-1">
          <div className="text-sm text-zinc-200">{userName}</div>
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm text-zinc-400">
            <span>{transitionLabel}</span>
            <span className="text-xs text-zinc-500">{timestamp}</span>
          </div>
        </div>
        <span className="shrink-0 text-zinc-500">{isExpanded ? "▼" : "▶"}</span>
      </button>
      {isExpanded && (
        <div className="space-y-1.5 border-t border-zinc-700 px-2 py-1.5 lg:px-3 lg:py-2">
          {ratedItems.map((item) => (
            <AdminFeedbackItemRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function AdminTransitionEmpty({ transition }: { transition: Transition }) {
  const userName = transition.user.name ?? transition.user.email ?? "Anonymous";
  const transitionLabel = [
    transition.fromLevel ? getLevelLabel(transition.fromLevel) : "-",
    " → ",
    transition.toLevel ? getLevelLabel(transition.toLevel) : "-",
  ].join("");
  const timestamp = transition.createdAt.toLocaleString("sv-SE");
  return (
    <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-1.5 lg:px-3 lg:py-2">
      <div className="min-w-0 flex-1">
        <div className="text-sm text-zinc-200">{userName}</div>
        <div className="flex flex-wrap items-baseline gap-x-2 text-sm text-zinc-400">
          <span>{transitionLabel}</span>
          <span className="text-xs text-zinc-500">{timestamp}</span>
        </div>
      </div>
      <span className="shrink-0 text-lg text-zinc-500" aria-label="No feedback">
        ∅
      </span>
    </div>
  );
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const topicIdParam =
    typeof router.query.topicId === "string"
      ? Number(router.query.topicId)
      : NaN;
  const selectedTopicId = Number.isNaN(topicIdParam) ? null : topicIdParam;

  const { data: session, isPending: sessionPending } = authClient.useSession();
  const status = api.admin.getAdminStatus.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const topicStats = api.admin.adminFeedbackTopicStats.useQuery(undefined, {
    enabled: !!session?.user && !!status.data?.isAdmin,
  });
  const transitions = api.admin.adminFeedbackByTopic.useQuery(
    { topicId: selectedTopicId! },
    {
      enabled:
        !!session?.user && !!status.data?.isAdmin && selectedTopicId != null,
    },
  );

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasLoadedSidebarPref, setHasLoadedSidebarPref] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem(
      ADMIN_FEEDBACK_SIDEBAR_COLLAPSED_KEY,
    );
    setSidebarCollapsed(saved === "1");
    setHasLoadedSidebarPref(true);
  }, []);
  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(
        ADMIN_FEEDBACK_SIDEBAR_COLLAPSED_KEY,
        next ? "1" : "",
      );
      return next;
    });
  };

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const transitionList = useMemo(
    () => transitions.data ?? [],
    [transitions.data],
  );
  useEffect(() => {
    if (transitionList.length > 0) {
      setExpandedIds(new Set(transitionList.map((t) => t.id)));
    }
  }, [selectedTopicId, transitionList]);
  const toggleExpanded = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectTopic = (id: number) => {
    void router.replace(
      { query: { ...router.query, topicId: id } },
      undefined,
      { shallow: true },
    );
  };

  const isAdmin = status.data?.isAdmin ?? false;
  const showContent = session?.user && isAdmin;

  return (
    <>
      <Head>
        <title>Feedback overview | Admin | AFFINE Tech Tree</title>
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
            hasLoadedSidebarPref ? "md:visible" : "md:invisible"
          }`}
        >
          {!session?.user && !sessionPending && (
            <div className="flex h-full items-center justify-center">
              <p className="text-zinc-500">Please sign in.</p>
            </div>
          )}
          {session?.user && !isAdmin && status.data !== undefined && (
            <div className="flex h-full items-center justify-center">
              <p className="text-zinc-500">Admin access required.</p>
            </div>
          )}
          {showContent && (
            <div
              className={`grid h-full min-h-0 md:gap-2 lg:gap-4 ${
                sidebarCollapsed ? "md:grid-cols-1" : "md:grid-cols-2"
              }`}
            >
              <section
                className={`hidden min-h-0 flex-col border-r border-zinc-800/80 pr-2 ${
                  sidebarCollapsed ? "md:hidden" : "md:flex"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h1 className="text-lg font-semibold text-zinc-100">
                    Feedback overview
                  </h1>
                  <Link
                    href="/admin"
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    Admin
                  </Link>
                </div>
                <div className="min-h-0 flex-1 space-y-1 overflow-y-auto [scrollbar-gutter:stable]">
                  {topicStats.data?.map((t) => (
                    <AdminTopicRow
                      key={t.id}
                      topic={t}
                      isSelected={selectedTopicId === t.id}
                      onSelect={() => selectTopic(t.id)}
                    />
                  ))}
                </div>
              </section>

              <div className="relative min-h-0">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  className="absolute -left-6 z-20 hidden h-24 w-4 rounded-full border border-transparent text-zinc-400 hover:border-orange-500/40 hover:bg-zinc-900/95 hover:text-orange-300 md:flex"
                  aria-label={
                    sidebarCollapsed ? "Show topic list" : "Hide topic list"
                  }
                  aria-expanded={!sidebarCollapsed}
                  title={
                    sidebarCollapsed ? "Show topic list" : "Hide topic list"
                  }
                >
                  <svg
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path d="M7 5V15" opacity="0.55" />
                    {sidebarCollapsed ? (
                      <path d="M10 8L13 10L10 12" />
                    ) : (
                      <path d="M14 8L11 10L14 12" />
                    )}
                  </svg>
                </button>
                <section className="h-full min-h-0 overflow-y-auto pt-2 pb-2 [scrollbar-gutter:stable] lg:pt-4 lg:pb-4">
                  <div className="mx-auto max-w-3xl pr-2 lg:pr-3">
                    {selectedTopicId == null ? (
                      <p className="text-zinc-500">
                        Select a topic to view feedback events.
                      </p>
                    ) : transitions.isLoading ? (
                      <p className="text-zinc-500">Loading…</p>
                    ) : (
                      <>
                        <h2 className="mb-3 text-lg font-semibold text-zinc-100">
                          {topicStats.data?.find(
                            (t) => t.id === selectedTopicId,
                          )?.name ?? "Topic"}
                        </h2>
                        <div className="space-y-2">
                          {transitionList.map((t) => {
                            const hasRated =
                              t.feedbackItems.some(hasRatedFeedback);
                            if (!hasRated) {
                              return (
                                <AdminTransitionEmpty
                                  key={t.id}
                                  transition={t}
                                />
                              );
                            }
                            return (
                              <AdminTransitionAccordion
                                key={t.id}
                                transition={t}
                                isExpanded={expandedIds.has(t.id)}
                                onToggle={() => toggleExpanded(t.id)}
                              />
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
