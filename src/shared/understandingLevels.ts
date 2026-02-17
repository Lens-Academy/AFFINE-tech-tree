import { z } from "zod";

export const understandingLevelSchema = z.enum([
  "not_yet",
  "want_to_learn",
  "want_to_learn_next",
  "in_progress",
  "backburner",
  "almost_get_it",
  "can_teach",
]);

export type UnderstandingLevel = z.infer<typeof understandingLevelSchema>;

export const UNDERSTANDING_LEVELS = understandingLevelSchema.options;

export const UNDERSTANDING_LEVEL_LABELS: Record<UnderstandingLevel, string> = {
  not_yet: "Not yet",
  want_to_learn: "Want to learn",
  want_to_learn_next: "Want to learn next",
  in_progress: "In progress",
  backburner: "Backburner",
  almost_get_it: "Almost get it",
  can_teach: "Understand enough to teach",
};
