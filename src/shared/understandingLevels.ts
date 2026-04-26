import { z } from "zod";

export const UNDERSTANDING_LEVELS = [
  "unfamiliar",
  "vague",
  "can_teach",
  "advanced_questions_welcome",
] as const;

export const understandingLevelSchema = z.enum(UNDERSTANDING_LEVELS);

export type UnderstandingLevel = z.infer<typeof understandingLevelSchema>;
export type UnderstandingLevelCounts = Record<UnderstandingLevel, number>;

export const UNDERSTANDING_LEVEL_LABELS: Record<UnderstandingLevel, string> = {
  unfamiliar: "Unfamiliar",
  vague: "Vague",
  can_teach: "Can Teach",
  advanced_questions_welcome: "Advanced Questions Welcome",
};

/** Hex colors for each level; used by the progress chart and legend. */
export const LEVEL_COLORS: Record<UnderstandingLevel, string> = {
  unfamiliar: "#52525b", // zinc-600
  vague: "#eab308", // yellow-500
  can_teach: "#f97316", // orange-500
  advanced_questions_welcome: "#a3e635", // lime-400
};

export function emptyUnderstandingLevelCounts(): UnderstandingLevelCounts {
  return {
    unfamiliar: 0,
    vague: 0,
    can_teach: 0,
    advanced_questions_welcome: 0,
  };
}

export function sumUnderstandingLevelCounts(
  counts: UnderstandingLevelCounts,
): number {
  return (
    counts.unfamiliar +
    counts.vague +
    counts.can_teach +
    counts.advanced_questions_welcome
  );
}

export const TEACHER_LEVELS: readonly UnderstandingLevel[] = [
  "can_teach",
  "advanced_questions_welcome",
] as const;

export function isTeacherLevel(level: string | undefined): boolean {
  return (TEACHER_LEVELS as readonly string[]).includes(level ?? "");
}

/** Returns the label for a level, or the raw DB value if unknown. */
export function getLevelLabel(level: string): string {
  return level in UNDERSTANDING_LEVEL_LABELS
    ? UNDERSTANDING_LEVEL_LABELS[level as UnderstandingLevel]
    : level;
}

/** Short label for compact UI (e.g. "Advanced" instead of "Advanced Questions Welcome"). */
export function getLevelShortLabel(level: UnderstandingLevel): string {
  return level === "advanced_questions_welcome"
    ? "Advanced"
    : UNDERSTANDING_LEVEL_LABELS[level];
}
