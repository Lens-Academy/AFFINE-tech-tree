import { describe, expect, it } from "vitest";

import {
  compareTeachers,
  selectLatestResourceVotes,
  type ResourceVoteRow,
  type TeacherSortRow,
} from "./topic.helpers";

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

describe("selectLatestResourceVotes", () => {
  it("treats an updated existing feedback row as the latest vote", () => {
    const rows: ResourceVoteRow[] = [
      {
        id: 10,
        userId: "user-1",
        topicLinkId: 1,
        rating: "really_helpful",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-03T00:00:00Z"),
      },
      {
        id: 11,
        userId: "user-1",
        topicLinkId: 1,
        rating: "actively_unhelpful",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        updatedAt: null,
      },
    ];

    const votes = [...selectLatestResourceVotes(rows)];

    expect(votes).toMatchObject([
      {
        id: 10,
        topicLinkId: 1,
        rating: "really_helpful",
      },
    ]);
  });

  it("falls back to createdAt when updatedAt is null", () => {
    const rows: ResourceVoteRow[] = [
      {
        id: 10,
        userId: "user-1",
        topicLinkId: 1,
        rating: "really_helpful",
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: null,
      },
      {
        id: 11,
        userId: "user-1",
        topicLinkId: 1,
        rating: "actively_unhelpful",
        createdAt: new Date("2026-01-02T00:00:00Z"),
        updatedAt: null,
      },
    ];

    const votes = [...selectLatestResourceVotes(rows)];

    expect(votes).toMatchObject([
      {
        id: 11,
        topicLinkId: 1,
        rating: "actively_unhelpful",
      },
    ]);
  });

  it("uses id as a tie-breaker for equal timestamps", () => {
    const timestamp = new Date("2026-01-01T00:00:00Z");
    const rows: ResourceVoteRow[] = [
      {
        id: 10,
        userId: "user-1",
        topicLinkId: 1,
        rating: "really_helpful",
        createdAt: timestamp,
        updatedAt: null,
      },
      {
        id: 11,
        userId: "user-1",
        topicLinkId: 1,
        rating: "actively_unhelpful",
        createdAt: timestamp,
        updatedAt: null,
      },
    ];

    const votes = [...selectLatestResourceVotes(rows)];

    expect(votes).toMatchObject([
      {
        id: 11,
        topicLinkId: 1,
        rating: "actively_unhelpful",
      },
    ]);
  });
});
