import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

import { AvailabilityCircle } from "~/components/AvailabilityCircle";
import { PageLayout } from "~/components/PageLayout";
import { TopicAffordanceIcon } from "~/components/TopicAffordanceIcon";
import { useAppMutation } from "~/hooks/useAppMutation";
import { useViewerAccess } from "~/hooks/useViewerAccess";
import { api, type RouterInputs, type RouterOutputs } from "~/utils/api";

type SendRequestOptions = Exclude<
  Parameters<typeof api.match.sendRequest.useMutation>[0],
  undefined
>;
type RespondOptions = Exclude<
  Parameters<typeof api.match.respondToRequest.useMutation>[0],
  undefined
>;

export default function UsersPage() {
  const { rawUser, viewerUser, isPending } = useViewerAccess();
  const utils = api.useUtils();
  const peers = api.match.listPeersInSegment.useQuery(undefined, {
    enabled: !!viewerUser,
  });
  const incoming = api.match.listIncoming.useQuery(undefined, {
    enabled: !!viewerUser,
  });
  const matches = api.match.listMatches.useQuery(undefined, {
    enabled: !!viewerUser,
  });

  const sendRequest = useAppMutation(
    (opts: SendRequestOptions) => api.match.sendRequest.useMutation(opts),
    {
      onMutate: async (rawVars) => {
        const vars = rawVars as RouterInputs["match"]["sendRequest"];
        await utils.match.listPeersInSegment.cancel();
        const previous = utils.match.listPeersInSegment.getData();
        utils.match.listPeersInSegment.setData(undefined, (old) => {
          if (!old) return old;
          return {
            ...old,
            peers: old.peers.map((p) =>
              p.id === vars.toUserId
                ? { ...p, matchState: "pending_outgoing", matchId: null }
                : p,
            ),
          };
        });
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        const context = ctx as
          | { previous?: RouterOutputs["match"]["listPeersInSegment"] }
          | undefined;
        if (context?.previous) {
          utils.match.listPeersInSegment.setData(undefined, context.previous);
        }
      },
      refresh: [
        () => utils.match.listPeersInSegment.invalidate(),
        () => utils.match.listIncoming.invalidate(),
        () => utils.match.listMatches.invalidate(),
      ],
    },
  );
  const respond = useAppMutation(
    (opts: RespondOptions) => api.match.respondToRequest.useMutation(opts),
    {
      onMutate: async (rawVars) => {
        const vars = rawVars as RouterInputs["match"]["respondToRequest"];
        await utils.match.listIncoming.cancel();
        const previous = utils.match.listIncoming.getData();
        utils.match.listIncoming.setData(undefined, (old) =>
          (old ?? []).filter((r) => r.id !== vars.requestId),
        );
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        const context = ctx as
          | { previous?: RouterOutputs["match"]["listIncoming"] }
          | undefined;
        if (context?.previous) {
          utils.match.listIncoming.setData(undefined, context.previous);
        }
      },
      refresh: [
        () => utils.match.listIncoming.invalidate(),
        () => utils.match.listMatches.invalidate(),
        () => utils.match.listPeersInSegment.invalidate(),
      ],
    },
  );

  const [confirmTargetId, setConfirmTargetId] = useState<string | null>(null);

  const peersData = peers.data;
  const visiblePeers =
    peersData?.peers.filter((peer) => peer.matchState !== "accepted") ?? [];

  return (
    <>
      <Head>
        <title>Match | AFFINE Tech Tree</title>
      </Head>
      <PageLayout>
        <div>
          {isPending && <p className="text-zinc-500">Loading session…</p>}
          {!isPending && !rawUser && (
            <p className="text-zinc-400">
              Please sign in to view peers in your segment.
            </p>
          )}

          {rawUser && peersData && (
            <div className="space-y-6">
              {incoming.data && incoming.data.length > 0 && (
                <div className="rounded-lg border border-orange-500/40 bg-zinc-900 p-4">
                  <h2 className="mb-3 text-zinc-200">
                    Incoming match requests
                  </h2>
                  <ul className="space-y-2">
                    {incoming.data.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 rounded border border-zinc-800 px-3 py-2"
                      >
                        <span className="text-sm text-zinc-200">
                          {r.fromUser.name ?? r.fromUser.email}
                          <AvailabilityDot user={r.fromUser} /> wants to match
                          for peer tuition.
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              respond.mutate({
                                requestId: r.id,
                                accept: true,
                              })
                            }
                            disabled={respond.isPending}
                            className="rounded bg-orange-500 px-3 py-1 text-xs font-medium text-zinc-950 hover:bg-orange-400 disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              respond.mutate({
                                requestId: r.id,
                                accept: false,
                              })
                            }
                            disabled={respond.isPending}
                            className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
                          >
                            No
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {matches.data && matches.data.length > 0 && (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                  <h2 className="mb-3 text-zinc-200">Your matches</h2>
                  <ul className="space-y-2">
                    {matches.data.map((m) => (
                      <li key={m.id}>
                        <Link
                          href={`/match/${m.id}`}
                          className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2 transition hover:border-orange-500/40"
                        >
                          <span className="text-sm text-zinc-200">
                            {m.other.name ?? m.other.email}
                            <AvailabilityDot user={m.other} />
                          </span>
                          <span className="text-xs text-orange-400">
                            View tuition topics →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                <h2 className="mb-3 text-zinc-200">Peers</h2>
                {visiblePeers.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No peers available for a new match request.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {visiblePeers.map((p) => (
                      <li
                        key={p.id}
                        className="rounded border border-zinc-800 p-3"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            if (p.matchState === "none") {
                              setConfirmTargetId(p.id);
                            }
                          }}
                          disabled={p.matchState !== "none"}
                          className="w-full text-left disabled:cursor-default"
                        >
                          <PeerSummary
                            peer={p}
                            actionLabel={
                              p.matchState === "pending_outgoing"
                                ? "Match request sent"
                                : p.matchState === "pending_incoming"
                                  ? "Respond above"
                                  : "Match for tuition →"
                            }
                          />
                        </button>

                        {p.matchState === "none" &&
                          confirmTargetId === p.id && (
                            <div className="mt-3 rounded border border-orange-500/40 bg-zinc-950 p-3 text-sm">
                              <p className="mb-2 text-zinc-200">
                                Match for tuition session?
                              </p>
                              <p className="mb-3 text-zinc-400">
                                Send this user a match request to suggest peer
                                tuition topics?
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    sendRequest.mutate({ toUserId: p.id });
                                    setConfirmTargetId(null);
                                  }}
                                  disabled={sendRequest.isPending}
                                  className="rounded bg-orange-500 px-3 py-1 text-xs font-medium text-zinc-950 hover:bg-orange-400 disabled:opacity-50"
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmTargetId(null)}
                                  className="rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-200 hover:bg-zinc-700"
                                >
                                  No
                                </button>
                              </div>
                            </div>
                          )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </PageLayout>
    </>
  );
}

function PeerSummary({
  peer,
  actionLabel,
}: {
  peer: {
    id: string;
    name: string | null;
    email: string;
    availableForTutoring: boolean;
    starredTopics: { id: number; name: string }[];
  };
  actionLabel: string;
}) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-zinc-100">
          {peer.name ?? peer.email}
          <AvailabilityDot user={peer} />
        </span>
        <span className="text-xs text-orange-400">{actionLabel}</span>
      </div>
      {peer.starredTopics.length > 0 ? (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-400">
          {peer.starredTopics.map((t) => (
            <li key={t.id} className="flex items-center gap-1">
              <TopicAffordanceIcon
                variant="read-only"
                kind="star"
                filled
                title="Excited to teach"
              />
              {t.name}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-1 text-xs text-zinc-600">
          Not excited to teach anything yet
        </div>
      )}
    </>
  );
}

function AvailabilityDot({
  user,
}: {
  user: { availableForTutoring: boolean };
}) {
  return (
    <AvailabilityCircle
      available={user.availableForTutoring}
      className="ml-2"
    />
  );
}
