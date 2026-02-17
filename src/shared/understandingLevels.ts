import { z } from "zod";

export const understandingLevelSchema = z.enum([
  "unfamiliar",
  "vague",
  "can_teach",
  "advanced_questions_welcome",
]);

export type UnderstandingLevel = z.infer<typeof understandingLevelSchema>;

export const UNDERSTANDING_LEVELS = understandingLevelSchema.options;

export const UNDERSTANDING_LEVEL_LABELS: Record<UnderstandingLevel, string> = {
  unfamiliar: "Unfamiliar",
  vague: "Vague",
  can_teach: "Can Teach",
  advanced_questions_welcome: "Advanced Questions Welcome",
};

/** Returns the label for a level, or the raw DB value if unknown. */
export function getLevelLabel(level: string): string {
  return level in UNDERSTANDING_LEVEL_LABELS
    ? UNDERSTANDING_LEVEL_LABELS[level as UnderstandingLevel]
    : level;
}
