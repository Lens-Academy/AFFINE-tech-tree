import { useMemo } from "react";

import { type UnderstandingLevelCounts } from "~/shared/understandingLevels";
import { api } from "~/utils/api";

/**
 * Per-topic understanding-level counts for the whole approved class, shared by
 * the graph nodes, topic list cards, tuition match list, and the level
 * checkboxes inside topic preview/detail. One tRPC query backs all of them —
 * the cache deduplicates across page navigations and across components on the
 * same page, so callers can pull this freely.
 */
export function useLevelCounts(): {
  byTopic: Map<number, UnderstandingLevelCounts>;
  totalRespondents: number;
} {
  const { data } = api.topic.levelCountsAll.useQuery();
  const byTopic = useMemo(
    () => new Map((data?.byTopic ?? []).map((r) => [r.topicId, r.counts])),
    [data],
  );
  return { byTopic, totalRespondents: data?.totalRespondents ?? 0 };
}
