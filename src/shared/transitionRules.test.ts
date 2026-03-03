import { describe, expect, it } from "vitest";

import { SKIP_FEEDBACK_SENTINEL } from "~/shared/feedbackTypes";
import {
  isFeedbackActionableTransition,
  isRatedFeedbackInput,
  shouldCreateAdHocSameStateTransition,
} from "~/shared/transitionRules";

describe("isRatedFeedbackInput", () => {
  it("returns false for skip sentinel without rating/comment", () => {
    expect(
      isRatedFeedbackInput({
        freeTextValue: SKIP_FEEDBACK_SENTINEL,
        helpfulnessRating: null,
        comment: null,
      }),
    ).toBe(false);
  });

  it("returns true when helpfulness rating exists", () => {
    expect(
      isRatedFeedbackInput({
        freeTextValue: null,
        helpfulnessRating: "helpful",
        comment: null,
      }),
    ).toBe(true);
  });

  it("returns true when comment has non-whitespace content", () => {
    expect(
      isRatedFeedbackInput({
        freeTextValue: null,
        helpfulnessRating: null,
        comment: "  useful context  ",
      }),
    ).toBe(true);
  });

  it("returns false for empty feedback payload", () => {
    expect(
      isRatedFeedbackInput({
        freeTextValue: null,
        helpfulnessRating: null,
        comment: "   ",
      }),
    ).toBe(false);
  });
});

describe("shouldCreateAdHocSameStateTransition", () => {
  it("creates transition only on not-rated -> rated ad-hoc edge", () => {
    expect(
      shouldCreateAdHocSameStateTransition({
        isAdHocFeedback: true,
        wasRated: false,
        willBeRated: true,
      }),
    ).toBe(true);
  });

  it("does not create transition for repeated rated edits", () => {
    expect(
      shouldCreateAdHocSameStateTransition({
        isAdHocFeedback: true,
        wasRated: true,
        willBeRated: true,
      }),
    ).toBe(false);
  });

  it("does not create transition for non-ad-hoc feedback", () => {
    expect(
      shouldCreateAdHocSameStateTransition({
        isAdHocFeedback: false,
        wasRated: false,
        willBeRated: true,
      }),
    ).toBe(false);
  });
});

describe("isFeedbackActionableTransition", () => {
  it("accepts only defined-to-defined real changes", () => {
    expect(
      isFeedbackActionableTransition({
        fromLevel: null,
        toLevel: "vague",
      }),
    ).toBe(false);
    expect(
      isFeedbackActionableTransition({
        fromLevel: "vague",
        toLevel: null,
      }),
    ).toBe(false);
    expect(
      isFeedbackActionableTransition({
        fromLevel: "vague",
        toLevel: "vague",
      }),
    ).toBe(false);
    expect(
      isFeedbackActionableTransition({
        fromLevel: "vague",
        toLevel: "can_teach",
      }),
    ).toBe(true);
  });
});
