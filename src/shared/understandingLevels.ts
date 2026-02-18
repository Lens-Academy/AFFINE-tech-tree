import { z } from "zod";

export const UNDERSTANDING_LEVELS = [
  "unfamiliar",
  "vague",
  "can_teach",
  "advanced_questions_welcome",
] as const;

export const understandingLevelSchema = z.enum(UNDERSTANDING_LEVELS);

export type UnderstandingLevel = z.infer<typeof understandingLevelSchema>;

export const UNDERSTANDING_LEVEL_LABELS: Record<UnderstandingLevel, string> = {
  unfamiliar: "Unfamiliar",
  vague: "Vague",
  can_teach: "Can Teach",
  advanced_questions_welcome: "Advanced Questions Welcome",
};

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
