import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import {
  getLevelLabel,
  UNDERSTANDING_LEVEL_LABELS,
  UNDERSTANDING_LEVELS,
  understandingLevelSchema,
} from "~/shared/understandingLevels";
import { authClient } from "~/server/better-auth/client";
import { AuthHeader } from "~/components/AuthHeader";
import { api } from "~/utils/api";
import { useTopicStatusMutations } from "~/hooks/useTopicStatusMutations";

export default function TopicPage() {
  const router = useRouter();
  /** null = clearing in progress, undefined = use server, level = setting */
  const [pendingLevel, setPendingLevel] = useState<
    (typeof UNDERSTANDING_LEVELS)[number] | null | undefined
  >();
  const id = typeof router.query.id === "string" ? Number(router.query.id) : NaN;
  const { data: topic, isLoading } = api.topic.getById.useQuery(
    { id },
    { enabled: !Number.isNaN(id) }
  );
  const { data: session } = authClient.useSession();
  const { data: statuses } = api.userStatus.getAll.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const { setStatus, removeStatus } = useTopicStatusMutations(() =>
    setPendingLevel(undefined)
  );

  const serverLevel =
    topic && statuses
      ? statuses.find((s) => s.topicId === topic.id)?.level
      : undefined;
  const currentLevel =
    pendingLevel === null ? undefined : (pendingLevel ?? serverLevel);

  useEffect(() => {
    if (
      (pendingLevel && serverLevel === pendingLevel) ||
      (pendingLevel === null && serverLevel === undefined)
    ) {
      setPendingLevel(undefined);
    }
  }, [pendingLevel, serverLevel]);

  if (isLoading || !topic) {
    return (
      <main className="min-h-screen bg-zinc-950 px-4 py-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-zinc-500">
            {isLoading ? "Loading…" : "Topic not found"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <Head>
        <title>{topic.name} | AFFINE Tech Tree</title>
      </Head>
      <main className="min-h-screen bg-zinc-950 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Back to topics
            </Link>
            <AuthHeader />
          </div>

          <h1 className="mb-2 bg-linear-60 from-orange-400 to-5% to-zinc-100 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
            {topic.name}
          </h1>

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

          {session?.user && (
            <div className="mb-8">
              <label className="mb-2 block text-sm text-zinc-500">
                Your understanding
              </label>
              <select
                value={currentLevel ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setPendingLevel(null);
                    removeStatus.mutate({ topicId: topic.id });
                  } else {
                    const parsed = understandingLevelSchema.safeParse(value);
                    if (parsed.success) {
                      setPendingLevel(parsed.data);
                      setStatus.mutate({ topicId: topic.id, level: parsed.data });
                    }
                  }
                }}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              >
                <option value="">—</option>
                {currentLevel &&
                  !(currentLevel in UNDERSTANDING_LEVEL_LABELS) && (
                    <option value={currentLevel}>
                      {getLevelLabel(currentLevel)}
                    </option>
                  )}
                {UNDERSTANDING_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {UNDERSTANDING_LEVEL_LABELS[level]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {topic.topicLinks && topic.topicLinks.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-zinc-100 bg-clip-text text-lg font-semibold">
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
                    <li key={link.id} className="text-zinc-300 leading-relaxed">
                      {link.title}
                    </li>
                  ),
                )}
              </ul>
            </section>
          )}

          {topic.resources && topic.resources.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-zinc-100 bg-clip-text text-lg font-semibold">
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
                      <span className="ml-2 text-zinc-500 text-xs">
                        {r.type}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

