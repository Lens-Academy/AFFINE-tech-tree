import { describe, expect, it } from "vitest";

import { buildProgressDays, type ProgressChange } from "./progress.helpers";

function change(overrides: Partial<ProgressChange> = {}): ProgressChange {
  return {
    at: new Date("2026-04-10T12:00:00.000Z"),
    topicId: 1,
    topicName: "Topic",
    from: null,
    to: "vague",
    isBookmarked: false,
    isExcited: false,
    ...overrides,
  };
}

describe("buildProgressDays", () => {
  it("returns no days when there are no changes", () => {
    expect(buildProgressDays([])).toEqual([]);
  });

  it("keeps the full same-day change list while storing end-of-day totals", () => {
    const days = buildProgressDays([
      change({
        at: new Date("2026-04-10T09:00:00.000Z"),
        topicId: 1,
        topicName: "Topic A",
        from: null,
        to: "unfamiliar",
      }),
      change({
        at: new Date("2026-04-10T16:00:00.000Z"),
        topicId: 1,
        topicName: "Topic A",
        from: "unfamiliar",
        to: "vague",
      }),
      change({
        at: new Date("2026-04-10T18:00:00.000Z"),
        topicId: 2,
        topicName: "Topic B",
        from: null,
        to: "can_teach",
        isBookmarked: true,
      }),
    ]);

    expect(days).toHaveLength(1);
    expect(days[0]?.changes).toHaveLength(3);
    expect(days[0]?.counts).toEqual({
      unfamiliar: 0,
      vague: 1,
      can_teach: 1,
      advanced_questions_welcome: 0,
    });
  });

  it("carries totals forward across days and handles removals", () => {
    const days = buildProgressDays([
      change({
        at: new Date("2026-04-10T09:00:00.000Z"),
        topicId: 1,
        topicName: "Topic A",
        from: null,
        to: "advanced_questions_welcome",
      }),
      change({
        at: new Date("2026-04-11T08:00:00.000Z"),
        topicId: 2,
        topicName: "Topic B",
        from: null,
        to: "vague",
      }),
      change({
        at: new Date("2026-04-11T21:00:00.000Z"),
        topicId: 1,
        topicName: "Topic A",
        from: "advanced_questions_welcome",
        to: null,
      }),
    ]);

    expect(days).toEqual([
      {
        date: "2026-04-10",
        counts: {
          unfamiliar: 0,
          vague: 0,
          can_teach: 0,
          advanced_questions_welcome: 1,
        },
        changes: [days[0]!.changes[0]],
      },
      {
        date: "2026-04-11",
        counts: {
          unfamiliar: 0,
          vague: 1,
          can_teach: 0,
          advanced_questions_welcome: 0,
        },
        changes: [days[1]!.changes[0], days[1]!.changes[1]],
      },
    ]);
  });
});
