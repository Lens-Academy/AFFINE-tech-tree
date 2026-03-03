import { SKIP_FEEDBACK_SENTINEL } from "~/shared/feedbackTypes";

export function isRatedFeedbackInput(args: {
  freeTextValue: string | null | undefined;
  helpfulnessRating: string | null | undefined;
  comment: string | null | undefined;
}): boolean {
  if (args.freeTextValue === SKIP_FEEDBACK_SENTINEL) return false;
  return (
    args.helpfulnessRating != null ||
    (args.comment != null && args.comment.trim().length > 0)
  );
}

export function shouldCreateAdHocSameStateTransition(args: {
  isAdHocFeedback: boolean;
  wasRated: boolean;
  willBeRated: boolean;
}): boolean {
  return args.isAdHocFeedback && !args.wasRated && args.willBeRated;
}

export function isFeedbackActionableTransition(args: {
  fromLevel: string | null | undefined;
  toLevel: string | null | undefined;
}): boolean {
  return (
    args.fromLevel != null &&
    args.toLevel != null &&
    args.fromLevel !== args.toLevel
  );
}
