import type { UnderstandingLevel } from "~/shared/understandingLevels";

const TEACHER_LEVEL_RANK: Record<UnderstandingLevel, number> = {
  advanced_questions_welcome: 0,
  can_teach: 1,
  vague: 2,
  unfamiliar: 3,
};

export type TeacherSortRow = {
  level: UnderstandingLevel;
  excitedToTeach: boolean;
  available: boolean;
};

/**
 * Order: excited first, then higher level, then available.
 * Starred (excited-to-teach) teachers float to the top regardless of level.
 */
export function compareTeachers(a: TeacherSortRow, b: TeacherSortRow): number {
  const excitedDelta = Number(b.excitedToTeach) - Number(a.excitedToTeach);
  if (excitedDelta !== 0) return excitedDelta;
  const levelDelta = TEACHER_LEVEL_RANK[a.level] - TEACHER_LEVEL_RANK[b.level];
  if (levelDelta !== 0) return levelDelta;
  return Number(b.available) - Number(a.available);
}
