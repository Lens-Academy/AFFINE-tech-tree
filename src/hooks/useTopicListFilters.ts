import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";

const TOPIC_TAG_FILTER_STORAGE_KEY = "topicTagFilter";

type TopicTag = {
  name: string;
};

export function useTopicListFilters(tags: TopicTag[] | undefined) {
  const router = useRouter();
  const searchQuery = typeof router.query.q === "string" ? router.query.q : "";
  const [storedTag, setStoredTag] = useState<string | null>(null);
  const [isStoredTagLoaded, setIsStoredTagLoaded] = useState(false);

  useEffect(() => {
    setStoredTag(window.localStorage.getItem(TOPIC_TAG_FILTER_STORAGE_KEY));
    setIsStoredTagLoaded(true);
  }, []);

  const tagFilter = useMemo(() => {
    if (!isStoredTagLoaded) return null;
    if (storedTag === "all") return null;
    if (storedTag) return storedTag;
    return tags?.some((tag) => tag.name === "Core") ? "Core" : null;
  }, [isStoredTagLoaded, storedTag, tags]);

  const updateSearchQuery = (next: string) => {
    const query = { ...router.query };
    if (next) query.q = next;
    else delete query.q;

    void router.replace({ pathname: router.pathname, query }, undefined, {
      shallow: true,
      scroll: false,
    });
  };

  const setTagFilter = (next: string | null) => {
    const value = next ?? "all";
    window.localStorage.setItem(TOPIC_TAG_FILTER_STORAGE_KEY, value);
    setStoredTag(value);
  };

  return {
    searchQuery,
    tagFilter,
    setTagFilter,
    updateSearchQuery,
    isStoredTagLoaded,
  };
}
