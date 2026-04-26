import {
  emptyUnderstandingLevelCounts,
  type UnderstandingLevel,
  type UnderstandingLevelCounts,
} from "~/shared/understandingLevels";

export type ProgressChange = {
  at: Date;
  topicId: number;
  topicName: string;
  from: UnderstandingLevel | null;
  to: UnderstandingLevel | null;
  isBookmarked: boolean;
  isExcited: boolean;
};

export type ProgressDay = {
  date: string;
  counts: UnderstandingLevelCounts;
  changes: ProgressChange[];
};

export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildProgressDays(
  changes: readonly ProgressChange[],
): ProgressDay[] {
  const daysByKey = new Map<string, ProgressDay>();
  const counts = emptyUnderstandingLevelCounts();

  for (const change of changes) {
    if (change.from) counts[change.from]--;
    if (change.to) counts[change.to]++;

    const dayKey = toIsoDay(change.at);
    let day = daysByKey.get(dayKey);
    if (!day) {
      day = {
        date: dayKey,
        counts: emptyUnderstandingLevelCounts(),
        changes: [],
      };
      daysByKey.set(dayKey, day);
    }

    day.changes.push(change);
    day.counts = { ...counts };
  }

  return [...daysByKey.values()].sort((a, b) => a.date.localeCompare(b.date));
}
