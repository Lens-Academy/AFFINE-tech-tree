import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { PageShell } from "~/components/PageShell";
import { TopicList } from "~/components/TopicList";
import { TopicDetail } from "~/features/topic-detail/TopicDetail";
import { api } from "~/utils/api";

const TOPIC_LIST_COLLAPSED_STORAGE_KEY =
  "affine.topic-detail.topic-list-collapsed";

export default function TopicPage() {
  const router = useRouter();
  const id =
    typeof router.query.id === "string" ? Number(router.query.id) : NaN;
  const { data: topic } = api.topic.getById.useQuery(
    { id },
    { enabled: !Number.isNaN(id) },
  );
  const [isTopicListCollapsed, setIsTopicListCollapsed] = useState(false);
  const [hasLoadedTopicListPreference, setHasLoadedTopicListPreference] =
    useState(false);

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
      <PageShell
        mainClassName={`max-w-7xl ${
          hasLoadedTopicListPreference ? "md:visible" : "md:invisible"
        }`}
      >
        <div
          className={`grid overflow-y-clip rounded-lg border border-zinc-800 bg-zinc-900 ${
            isTopicListCollapsed ? "md:grid-cols-1" : "md:grid-cols-2"
          }`}
        >
          <section
            // negative bottom margin (-mb and larger pb) to avoid double scroll of sticky column at bottom of page - adjust with footer height
            className={`hidden flex-col border-r border-zinc-800/80 p-4 md:sticky md:top-0 md:-mb-18 md:max-h-screen md:scroll-pt-4 md:overflow-y-auto md:pb-20 ${
              isTopicListCollapsed ? "md:hidden" : "md:flex"
            }`}
          >
            <TopicList />
          </section>

          <div className="relative">
            <button
              type="button"
              onClick={toggleTopicList}
              className="absolute -left-2 z-20 hidden h-24 w-4 rounded-full border border-transparent text-zinc-400 hover:border-orange-500/40 hover:bg-zinc-900/95 hover:text-orange-300 md:flex"
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
            <section className="p-4">
              <TopicDetail topicId={id} />
            </section>
          </div>
        </div>
      </PageShell>
    </>
  );
}
