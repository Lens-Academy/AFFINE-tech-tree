import { z } from "zod";

export const HELPFULNESS_RATINGS = [
  "really_helpful",
  "contributed_clarity",
  "somewhat_useful",
  "passively_unhelpful",
  "actively_unhelpful",
] as const;

export const helpfulnessRatingSchema = z.enum(HELPFULNESS_RATINGS);
export type HelpfulnessRating = z.infer<typeof helpfulnessRatingSchema>;

export const HELPFULNESS_RATING_LABELS: Record<HelpfulnessRating, string> = {
  really_helpful: "Really helpful - just clicked",
  contributed_clarity: "Contributed clarity",
  somewhat_useful: "Somewhat useful",
  passively_unhelpful: "Passively unhelpful / irrelevant",
  actively_unhelpful: "Actively unhelpful / confusing",
};

export const FEEDBACK_ITEM_TYPES = ["resource", "user", "free_text"] as const;

export const feedbackItemTypeSchema = z.enum(FEEDBACK_ITEM_TYPES);
export type FeedbackItemType = z.infer<typeof feedbackItemTypeSchema>;

/**
 * Sentinel value stored as freeTextValue when a user skips feedback for a
 * transition. Kept in shared/ so client and server always agree on the value.
 */
export const SKIP_FEEDBACK_SENTINEL = "__skip_feedback__";
