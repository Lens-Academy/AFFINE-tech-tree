import {
  isTeacherLevel,
  type UnderstandingLevel,
} from "~/shared/understandingLevels";

const MATCH_LEVEL_RANK: Record<UnderstandingLevel, number> = {
  unfamiliar: 0,
  vague: 1,
  can_teach: 2,
  advanced_questions_welcome: 3,
};

type TeachingDirection = "left_teaches" | "right_teaches";

export type MatchSortEntry = {
  learnerBookmarked: boolean;
  teacherStarred: boolean;
  learnerStarred: boolean;
  teacherAdvanced: boolean;
  learnerCanTeach: boolean;
  importance: number;
  spreadsheetRow: number | null;
  name: string;
};

function getLevelRank(level: UnderstandingLevel | undefined): number {
  return level ? MATCH_LEVEL_RANK[level] : -1;
}

export function getTeachingDirection(
  leftLevel: UnderstandingLevel | undefined,
  rightLevel: UnderstandingLevel | undefined,
): TeachingDirection | null {
  const leftRank = getLevelRank(leftLevel);
  const rightRank = getLevelRank(rightLevel);

  if (isTeacherLevel(leftLevel) && leftRank > rightRank) {
    return "left_teaches";
  }
  if (isTeacherLevel(rightLevel) && rightRank > leftRank) {
    return "right_teaches";
  }
  return null;
}

export function compareMatchEntries(
  a: MatchSortEntry,
  b: MatchSortEntry,
): number {
  const advancedCanTeachRank = (entry: MatchSortEntry) => {
    if (!entry.teacherAdvanced || !entry.learnerCanTeach) return 1;
    return entry.teacherStarred && entry.learnerStarred ? 0 : 2;
  };

  const advancedCanTeachRankA = advancedCanTeachRank(a);
  const advancedCanTeachRankB = advancedCanTeachRank(b);
  if (advancedCanTeachRankA !== advancedCanTeachRankB) {
    return advancedCanTeachRankA - advancedCanTeachRankB;
  }

  if (a.learnerBookmarked !== b.learnerBookmarked) {
    return a.learnerBookmarked ? -1 : 1;
  }
  if (a.teacherStarred !== b.teacherStarred) {
    return a.teacherStarred ? -1 : 1;
  }
  if (a.learnerStarred !== b.learnerStarred) {
    return a.learnerStarred ? -1 : 1;
  }
  if (a.teacherAdvanced !== b.teacherAdvanced) {
    return a.teacherAdvanced ? -1 : 1;
  }
  if (a.importance !== b.importance) return b.importance - a.importance;

  const ar = a.spreadsheetRow ?? Number.MAX_SAFE_INTEGER;
  const br = b.spreadsheetRow ?? Number.MAX_SAFE_INTEGER;
  if (ar !== br) return ar - br;

  return a.name.localeCompare(b.name);
}
