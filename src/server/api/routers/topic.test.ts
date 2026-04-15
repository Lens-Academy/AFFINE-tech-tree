import { describe, expect, it } from "vitest";

import { compareTeachers, type TeacherSortRow } from "./topic.helpers";

function label(row: TeacherSortRow): string {
  const parts = [
    row.available ? "avail" : "not-avail",
    row.excitedToTeach ? "excited" : "not-excited",
    row.level,
  ];
  return parts.join("+");
}

describe("compareTeachers", () => {
  it("floats excited to the top, then orders by level desc, then available", () => {
    const rows: TeacherSortRow[] = [
      { level: "can_teach", excitedToTeach: false, available: true },
      {
        level: "advanced_questions_welcome",
        excitedToTeach: false,
        available: true,
      },
      { level: "can_teach", excitedToTeach: true, available: false },
      {
        level: "advanced_questions_welcome",
        excitedToTeach: true,
        available: false,
      },
      { level: "can_teach", excitedToTeach: true, available: true },
      {
        level: "advanced_questions_welcome",
        excitedToTeach: false,
        available: false,
      },
    ];

    const sorted = [...rows].sort(compareTeachers).map(label);

    expect(sorted).toEqual([
      "not-avail+excited+advanced_questions_welcome",
      "avail+excited+can_teach",
      "not-avail+excited+can_teach",
      "avail+not-excited+advanced_questions_welcome",
      "not-avail+not-excited+advanced_questions_welcome",
      "avail+not-excited+can_teach",
    ]);
  });
});
