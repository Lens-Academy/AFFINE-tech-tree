import { describe, expect, it } from "vitest";

import { buildProgressDays, type ProgressChange } from "./progress.helpers";
import { emptyUnderstandingLevelCounts } from "~/shared/understandingLevels";

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
    expect(buildProgressDays([], emptyUnderstandingLevelCounts())).toEqual([]);
  });

  it("returns a current snapshot when counts exist but there are no changes", () => {
    const currentCounts = emptyUnderstandingLevelCounts();
    currentCounts.unfamiliar = 2;
    currentCounts.vague = 3;

    const [day] = buildProgressDays([], currentCounts);

    expect(day?.counts).toEqual(currentCounts);
    expect(day?.changes).toEqual([]);
  });

  it("keeps the full same-day change list while storing end-of-day totals", () => {
    const currentCounts = emptyUnderstandingLevelCounts();
    currentCounts.vague = 1;
    currentCounts.can_teach = 1;

    const days = buildProgressDays(
      [
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
      ],
      currentCounts,
    );

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
    const currentCounts = emptyUnderstandingLevelCounts();
    currentCounts.vague = 1;

    const days = buildProgressDays(
      [
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
      ],
      currentCounts,
    );

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

  it("preserves existing low-level counts when initial transitions are missing", () => {
    const currentCounts = emptyUnderstandingLevelCounts();
    currentCounts.advanced_questions_welcome = 2;
    currentCounts.can_teach = 30;
    currentCounts.unfamiliar = 5;
    currentCounts.vague = 33;

    const days = buildProgressDays(
      [
        change({
          at: new Date("2026-04-10T09:00:00.000Z"),
          from: null,
          to: "advanced_questions_welcome",
        }),
        change({
          at: new Date("2026-04-10T10:00:00.000Z"),
          topicId: 2,
          from: null,
          to: "advanced_questions_welcome",
        }),
        change({
          at: new Date("2026-04-10T11:00:00.000Z"),
          topicId: 3,
          from: null,
          to: "can_teach",
        }),
        change({
          at: new Date("2026-04-10T12:00:00.000Z"),
          topicId: 4,
          from: null,
          to: "can_teach",
        }),
        change({
          at: new Date("2026-04-10T13:00:00.000Z"),
          topicId: 5,
          from: null,
          to: "can_teach",
        }),
        change({
          at: new Date("2026-04-11T09:00:00.000Z"),
          topicId: 6,
          from: "can_teach",
          to: "vague",
        }),
        change({
          at: new Date("2026-04-12T09:00:00.000Z"),
          topicId: 7,
          from: "vague",
          to: "can_teach",
        }),
        change({
          at: new Date("2026-04-13T09:00:00.000Z"),
          topicId: 8,
          from: "vague",
          to: "can_teach",
        }),
      ],
      currentCounts,
    );

    expect(days.at(-1)?.counts).toEqual(currentCounts);
    expect(days.at(-1)?.counts.unfamiliar).toBe(5);
    expect(days.at(-1)?.counts.vague).toBe(33);
  });
});
