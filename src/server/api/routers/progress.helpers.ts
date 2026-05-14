import {
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
  currentCounts: UnderstandingLevelCounts,
): ProgressDay[] {
  if (changes.length === 0) {
    const hasAnyCounts = Object.values(currentCounts).some(
      (count) => count > 0,
    );
    if (!hasAnyCounts) return [];
    return [
      {
        date: toIsoDay(new Date()),
        counts: { ...currentCounts },
        changes: [],
      },
    ];
  }

  const daysByKey = new Map<string, ProgressDay>();
  const counts = { ...currentCounts };

  for (let index = changes.length - 1; index >= 0; index--) {
    const change = changes[index]!;

    const dayKey = toIsoDay(change.at);
    let day = daysByKey.get(dayKey);
    if (!day) {
      day = {
        date: dayKey,
        counts: {
          unfamiliar: Math.max(0, counts.unfamiliar),
          vague: Math.max(0, counts.vague),
          can_teach: Math.max(0, counts.can_teach),
          advanced_questions_welcome: Math.max(
            0,
            counts.advanced_questions_welcome,
          ),
        },
        changes: [],
      };
      daysByKey.set(dayKey, day);
    }

    day.changes.unshift(change);

    if (change.to) counts[change.to] = Math.max(0, counts[change.to] - 1);
    if (change.from) counts[change.from]++;
  }

  return [...daysByKey.values()].sort((a, b) => a.date.localeCompare(b.date));
}
