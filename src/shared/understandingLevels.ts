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

/**
 * Hex colors for each level. Used for *fills*: donut segments, the inner dot
 * of a selected checkbox, the 10–20% background tint on a selected button.
 * Unfamiliar is deliberately near-null dark so an "almost untouched" topic
 * reads as almost-null in the donut.
 */
export const LEVEL_COLORS: Record<UnderstandingLevel, string> = {
  unfamiliar: "#3f3f46", // zinc-700
  vague: "#eab308", // yellow-500
  can_teach: "#f97316", // orange-500
  advanced_questions_welcome: "#a3e635", // lime-400
};

/**
 * Contrast-safe "ink" shade for each level, used where the colour carries
 * meaning on a dark background — text (count numbers) and stroke (selected
 * button borders). For vivid levels the ink equals the fill; only unfamiliar
 * needs a lighter shade so it stays legible.
 */
export const LEVEL_INK_COLORS: Record<UnderstandingLevel, string> = {
  ...LEVEL_COLORS,
  unfamiliar: "#a1a1aa", // zinc-400
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
