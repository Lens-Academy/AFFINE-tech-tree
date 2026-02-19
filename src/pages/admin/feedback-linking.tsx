import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

import { AuthHeader } from "~/components/AuthHeader";
import { useAppMutation } from "~/hooks/useAppMutation";
import { authClient } from "~/server/better-auth/client";
import { api, type RouterOutputs } from "~/utils/api";

type Candidate = RouterOutputs["admin"]["listFeedbackLinkCandidates"][number];
type ApplySuggestionMutationOptions = Exclude<
  Parameters<typeof api.admin.applyFeedbackLinkSuggestion.useMutation>[0],
  undefined
>;
type ManualTopicLinkMutationOptions = Exclude<
  Parameters<typeof api.admin.manualLinkFeedbackTopicLink.useMutation>[0],
  undefined
>;
type ManualTeacherMutationOptions = Exclude<
  Parameters<typeof api.admin.manualLinkFeedbackTeacher.useMutation>[0],
  undefined
>;

function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function extractEmail(value: string): string {
  const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
  const match = emailRegex.exec(value.trim());
  return match?.[0] ?? "";
}

export default function FeedbackLinkingAdminPage() {
  const { data: session, isPending } = authClient.useSession();
  const utils = api.useUtils();
  const [mutationMessage, setMutationMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [busyByCandidateId, setBusyByCandidateId] = useState<
    Record<number, boolean>
  >({});

  const setSuccess = (text: string) =>
    setMutationMessage({ type: "success", text });
  const setError = (text: string) =>
    setMutationMessage({ type: "error", text });

  const status = api.admin.getAdminStatus.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const candidates = api.admin.listFeedbackLinkCandidates.useQuery(undefined, {
    enabled: !!session?.user && !!status.data?.isAdmin,
  });
  const applySuggestion = useAppMutation(
    (opts: ApplySuggestionMutationOptions) =>
      api.admin.applyFeedbackLinkSuggestion.useMutation(opts),
    {
      onMutate: (vars) => {
        const input = vars as { feedbackItemId: number };
        setBusyByCandidateId((old) => ({
          ...old,
          [input.feedbackItemId]: true,
        }));
      },
      onSuccess: () => {
        setSuccess("Suggestion applied.");
      },
      onError: (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to apply suggestion.";
        setError(message);
      },
      onSettled: (_data, _error, vars) => {
        const input = vars as { feedbackItemId: number };
        setBusyByCandidateId((old) => {
          const next = { ...old };
          delete next[input.feedbackItemId];
          return next;
        });
      },
      refresh: [() => utils.admin.listFeedbackLinkCandidates.invalidate()],
    },
  );
  const manualTopicLink = useAppMutation(
    (opts: ManualTopicLinkMutationOptions) =>
      api.admin.manualLinkFeedbackTopicLink.useMutation(opts),
    {
      onMutate: (vars) => {
        const input = vars as { feedbackItemId: number };
        setBusyByCandidateId((old) => ({
          ...old,
          [input.feedbackItemId]: true,
        }));
      },
      onSuccess: () => {
        setSuccess("Manual resource link saved.");
      },
      onError: (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to save manual resource link.";
        setError(message);
      },
      onSettled: (_data, _error, vars) => {
        const input = vars as { feedbackItemId: number };
        setBusyByCandidateId((old) => {
          const next = { ...old };
          delete next[input.feedbackItemId];
          return next;
        });
      },
      refresh: [() => utils.admin.listFeedbackLinkCandidates.invalidate()],
    },
  );
  const manualTeacher = useAppMutation(
    (opts: ManualTeacherMutationOptions) =>
      api.admin.manualLinkFeedbackTeacher.useMutation(opts),
    {
      onMutate: (vars) => {
        const input = vars as { feedbackItemId: number };
        setBusyByCandidateId((old) => ({
          ...old,
          [input.feedbackItemId]: true,
        }));
      },
      onSuccess: () => {
        setSuccess("Teacher link updated.");
      },
      onError: (error) => {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to update teacher link.";
        setError(message);
      },
      onSettled: (_data, _error, vars) => {
        const input = vars as { feedbackItemId: number };
        setBusyByCandidateId((old) => {
          const next = { ...old };
          delete next[input.feedbackItemId];
          return next;
        });
      },
      refresh: [() => utils.admin.listFeedbackLinkCandidates.invalidate()],
    },
  );

  return (
    <>
      <Head>
        <title>Free-text feedback management | Admin</title>
      </Head>
      <main className="min-h-screen bg-zinc-950 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-5xl">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/admin"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Back to admin
            </Link>
            <AuthHeader />
          </div>

          <h1 className="mb-4 text-2xl font-bold text-zinc-100">
            Free-text feedback management
          </h1>
          {isPending && <p className="text-zinc-500">Loading session…</p>}
          {!isPending && !session?.user && (
            <p className="text-zinc-400">
              Please sign in to access admin features.
            </p>
          )}
          {session?.user && status.data && !status.data.isAdmin && (
            <p className="text-zinc-400">Admin access required.</p>
          )}

          {session?.user && status.data?.isAdmin && (
            <>
              <p className="mb-4 text-sm text-zinc-500">
                Deduplicate free-text feedback items:
              </p>
              {mutationMessage ? (
                <p
                  className={`mb-4 rounded border px-3 py-2 text-sm ${
                    mutationMessage.type === "error"
                      ? "border-red-500/40 bg-red-500/10 text-red-300"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  }`}
                >
                  {mutationMessage.text}
                </p>
              ) : null}
              {candidates.isLoading ? (
                <p className="text-zinc-500">Loading…</p>
              ) : (candidates.data ?? []).length === 0 ? (
                <p className="text-zinc-500">No unresolved candidates.</p>
              ) : (
                <ul className="space-y-3">
                  {(candidates.data ?? []).map((c) => {
                    return (
                      <CandidateRow
                        key={c.id}
                        candidate={c}
                        applySuggestion={applySuggestion.mutate}
                        manualTopicLink={manualTopicLink.mutate}
                        manualTeacher={manualTeacher.mutate}
                        busy={!!busyByCandidateId[c.id]}
                      />
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function CandidateRow({
  candidate,
  applySuggestion,
  manualTopicLink,
  manualTeacher,
  busy,
}: {
  candidate: Candidate;
  applySuggestion: (input: {
    feedbackItemId: number;
    topicLinkId?: number | null;
    referencedUserId?: string | null;
  }) => void;
  manualTopicLink: (input: {
    feedbackItemId: number;
    title: string;
    url?: string;
  }) => void;
  manualTeacher: (input: {
    feedbackItemId: number;
    name: string;
    email?: string;
  }) => void;
  busy: boolean;
}) {
  const text = candidate.freeTextValue?.trim() ?? "";
  const prefillUrl = isHttpUrl(text) ? text : "";
  const prefillEmail = extractEmail(text);
  const prefillName = prefillUrl || prefillEmail ? "" : text;

  const [resourceTitle, setResourceTitle] = useState(
    prefillUrl ? "Shared resource" : text.slice(0, 120),
  );
  const [resourceUrl, setResourceUrl] = useState(prefillUrl);
  const [teacherName, setTeacherName] = useState(prefillName);
  const [teacherEmail, setTeacherEmail] = useState(prefillEmail);
  const exactTopicLink = candidate.exactTopicLink;
  const exactTeacher = candidate.exactUser;

  return (
    <li className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <div className="mb-3">
        <p className="text-sm text-zinc-200">
          <span className="text-zinc-500">Topic:</span>{" "}
          {candidate.transition.topic.name}
        </p>
        <p className="mt-1 text-sm text-zinc-300">{candidate.freeTextValue}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <section className="rounded border border-zinc-800 p-3">
          <h2 className="mb-2 text-sm font-medium text-zinc-200">
            Topic link suggestions
          </h2>
          {exactTopicLink ? (
            <button
              type="button"
              onClick={() =>
                applySuggestion({
                  feedbackItemId: candidate.id,
                  topicLinkId: exactTopicLink.id,
                })
              }
              disabled={busy}
              className="mb-2 block w-full rounded bg-orange-500/20 px-2 py-1 text-left text-xs text-orange-300 hover:bg-orange-500/30 disabled:opacity-60"
            >
              Exact: {exactTopicLink.title}
            </button>
          ) : null}
          <div className="space-y-1">
            {candidate.fuzzyTopicLinks.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  applySuggestion({
                    feedbackItemId: candidate.id,
                    topicLinkId: s.id,
                  })
                }
                disabled={busy}
                className="block w-full rounded bg-zinc-800 px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-60"
              >
                {s.title} ({Math.round(s.score * 100)}%)
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-500">Manual resource link</p>
            <input
              type="text"
              value={resourceTitle}
              onChange={(e) => setResourceTitle(e.target.value)}
              placeholder="Resource title"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500"
            />
            <input
              type="text"
              value={resourceUrl}
              onChange={(e) => setResourceUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => {
                const title = resourceTitle.trim();
                const url = resourceUrl.trim();
                if (!title) return;
                manualTopicLink({
                  feedbackItemId: candidate.id,
                  title,
                  url: url || undefined,
                });
              }}
              disabled={busy || !resourceTitle.trim()}
              className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600 disabled:opacity-60"
            >
              Save manual resource link
            </button>
          </div>
        </section>

        <section className="rounded border border-zinc-800 p-3">
          <h2 className="mb-2 text-sm font-medium text-zinc-200">
            Teacher suggestions
          </h2>
          {exactTeacher ? (
            <button
              type="button"
              onClick={() =>
                applySuggestion({
                  feedbackItemId: candidate.id,
                  referencedUserId: exactTeacher.id,
                })
              }
              disabled={busy}
              className="mb-2 block w-full rounded bg-orange-500/20 px-2 py-1 text-left text-xs text-orange-300 hover:bg-orange-500/30 disabled:opacity-60"
            >
              Exact teacher: {exactTeacher.name ?? exactTeacher.email}
            </button>
          ) : null}
          <div className="space-y-1">
            {candidate.fuzzyUsers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() =>
                  applySuggestion({
                    feedbackItemId: candidate.id,
                    referencedUserId: s.id,
                  })
                }
                disabled={busy}
                className="block w-full rounded bg-zinc-800 px-2 py-1 text-left text-xs text-zinc-300 hover:bg-zinc-700 disabled:opacity-60"
              >
                {(s.name ?? s.email) +
                  ` (${Math.round(s.score * 100)}%)` +
                  (s.isNonUser ? " · non-user" : "")}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-2 border-t border-zinc-800 pt-3">
            <p className="text-xs text-zinc-500">Manual teacher link</p>
            <input
              type="text"
              value={teacherName}
              onChange={(e) => setTeacherName(e.target.value)}
              placeholder="Teacher name"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500"
            />
            <input
              type="email"
              value={teacherEmail}
              onChange={(e) => setTeacherEmail(e.target.value)}
              placeholder="teacher@email.com (required to create new non-user)"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-100 placeholder:text-zinc-500"
            />
            <button
              type="button"
              onClick={() => {
                const name = teacherName.trim();
                const email = teacherEmail.trim();
                if (!name) return;
                manualTeacher({
                  feedbackItemId: candidate.id,
                  name,
                  email: email || undefined,
                });
              }}
              disabled={busy || !teacherName.trim()}
              className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600 disabled:opacity-60"
            >
              Link or create non-user teacher
            </button>
          </div>
        </section>
      </div>
    </li>
  );
}
