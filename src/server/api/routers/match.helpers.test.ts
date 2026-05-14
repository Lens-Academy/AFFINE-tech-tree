import { describe, expect, it } from "vitest";

import {
  compareMatchEntries,
  getTeachingDirection,
  type MatchSortEntry,
} from "./match.helpers";

describe("getTeachingDirection", () => {
  it("lets advanced users teach can-teach users", () => {
    expect(
      getTeachingDirection("advanced_questions_welcome", "can_teach"),
    ).toBe("left_teaches");
    expect(
      getTeachingDirection("can_teach", "advanced_questions_welcome"),
    ).toBe("right_teaches");
  });

  it("lets teacher-level users teach lower-level or unset users", () => {
    expect(getTeachingDirection("can_teach", "vague")).toBe("left_teaches");
    expect(getTeachingDirection("can_teach", undefined)).toBe("left_teaches");
    expect(getTeachingDirection(undefined, "can_teach")).toBe("right_teaches");
  });

  it("excludes equal levels and pairs where nobody can teach", () => {
    expect(
      getTeachingDirection(
        "advanced_questions_welcome",
        "advanced_questions_welcome",
      ),
    ).toBeNull();
    expect(getTeachingDirection("can_teach", "can_teach")).toBeNull();
    expect(getTeachingDirection("vague", "unfamiliar")).toBeNull();
  });
});

function entry(
  name: string,
  overrides: Partial<MatchSortEntry> = {},
): MatchSortEntry {
  return {
    name,
    learnerBookmarked: false,
    teacherStarred: false,
    learnerStarred: false,
    teacherAdvanced: false,
    learnerCanTeach: false,
    importance: 0,
    spreadsheetRow: null,
    ...overrides,
  };
}

describe("compareMatchEntries", () => {
  it("only promotes advanced/can-teach pairs when both people are excited", () => {
    const sorted = [
      entry("sheet row", { spreadsheetRow: 1 }),
      entry("learner starred", { learnerStarred: true }),
      entry("teacher starred", { teacherStarred: true }),
      entry("both starred", { teacherStarred: true, learnerStarred: true }),
      entry("important", { importance: 10 }),
      entry("advanced", { teacherAdvanced: true }),
      entry("bookmarked", { learnerBookmarked: true }),
      entry("advanced can-teach not both excited", {
        teacherAdvanced: true,
        learnerCanTeach: true,
        teacherStarred: true,
      }),
      entry("advanced can-teach both excited", {
        teacherAdvanced: true,
        learnerCanTeach: true,
        teacherStarred: true,
        learnerStarred: true,
      }),
    ]
      .sort(compareMatchEntries)
      .map((item) => item.name);

    expect(sorted).toEqual([
      "advanced can-teach both excited",
      "bookmarked",
      "both starred",
      "teacher starred",
      "learner starred",
      "advanced",
      "important",
      "sheet row",
      "advanced can-teach not both excited",
    ]);
  });
});
