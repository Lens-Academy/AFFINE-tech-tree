import { z } from "zod";

import { and, eq, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { TEACHER_LEVELS } from "~/shared/understandingLevels";
import {
  HELPFULNESS_RATINGS,
  type HelpfulnessRating,
} from "~/shared/feedbackTypes";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { feedbackItem } from "~/server/db/schema";

const HELPFULNESS_SCORE: Record<HelpfulnessRating, number> = {
  really_helpful: 2,
  contributed_clarity: 1,
  somewhat_useful: 0,
  passively_unhelpful: -1,
  actively_unhelpful: -2,
};

type RatingCounts = Record<HelpfulnessRating, number>;

function emptyRatingCounts(): RatingCounts {
  return {
    really_helpful: 0,
    contributed_clarity: 0,
    somewhat_useful: 0,
    passively_unhelpful: 0,
    actively_unhelpful: 0,
  };
}

export const topicRouter = createTRPCRouter({
  listTags: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.tag.findMany({
      orderBy: (t, { asc }) => [asc(t.name)],
    });
  }),

  list: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.topic.findMany({
      with: {
        topicTags: {
          with: {
            tag: true,
          },
        },
      },
      orderBy: (t, { asc }) => [asc(t.spreadsheetRow), asc(t.id)],
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const topicRow = await ctx.db.query.topic.findFirst({
        where: (t, { eq }) => eq(t.id, input.id),
        with: {
          topicTags: {
            with: {
              tag: true,
            },
          },
          topicLinks: {
            orderBy: (l, { asc }) => [asc(l.position)],
          },
          prerequisites: {
            with: {
              prerequisiteTopic: {
                columns: { id: true, name: true },
              },
            },
          },
          dependents: {
            with: {
              topic: {
                columns: { id: true, name: true },
              },
            },
          },
        },
      });
      if (!topicRow) return undefined;

      const linkIds = topicRow.topicLinks.map((l) => l.id);
      const countsByLink = new Map<number, RatingCounts>();
      if (linkIds.length > 0) {
        // One vote per (user, topicLink). A user may have rated the same link
        // across multiple level transitions — keep the latest row by id.
        const rows = await ctx.db
          .select({
            topicLinkId: feedbackItem.topicLinkId,
            userId: feedbackItem.userId,
            rating: feedbackItem.helpfulnessRating,
          })
          .from(feedbackItem)
          .where(
            and(
              eq(feedbackItem.type, "resource"),
              inArray(feedbackItem.topicLinkId, linkIds),
            ),
          )
          .orderBy(feedbackItem.id);
        const latestVote = new Map<
          string,
          { topicLinkId: number; rating: HelpfulnessRating | null }
        >();
        for (const row of rows) {
          if (row.topicLinkId == null) continue;
          latestVote.set(`${row.userId}:${row.topicLinkId}`, {
            topicLinkId: row.topicLinkId,
            rating: row.rating,
          });
        }
        for (const { topicLinkId, rating } of latestVote.values()) {
          if (rating == null) continue;
          let counts = countsByLink.get(topicLinkId);
          if (!counts) {
            counts = emptyRatingCounts();
            countsByLink.set(topicLinkId, counts);
          }
          counts[rating] += 1;
        }
      }

      const topicLinksWithRatings = topicRow.topicLinks
        .map((link) => {
          const ratingCounts = countsByLink.get(link.id) ?? emptyRatingCounts();
          let score = 0;
          let ratingCount = 0;
          for (const rating of HELPFULNESS_RATINGS) {
            score += HELPFULNESS_SCORE[rating] * ratingCounts[rating];
            ratingCount += ratingCounts[rating];
          }
          return { link, ratingCounts, score, ratingCount };
        })
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return b.ratingCount - a.ratingCount;
        })
        .map(({ link, ratingCounts }) => ({ ...link, ratingCounts }));

      return { ...topicRow, topicLinks: topicLinksWithRatings };
    }),

  getTeachers: protectedProcedure
    .input(z.object({ topicId: z.number() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.query.userTopicStatus.findMany({
        where: (s, { eq, and, inArray }) =>
          and(
            eq(s.topicId, input.topicId),
            inArray(s.level, [...TEACHER_LEVELS]),
          ),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              availableForTutoring: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      });
      return rows.map((r) => {
        const isAvailable = r.user.availableForTutoring;
        return {
          userId: r.user.id,
          name: r.user.name,
          level: r.level,
          available: isAvailable,
          latitude: isAvailable ? r.user.latitude : null,
          longitude: isAvailable ? r.user.longitude : null,
        };
      });
    }),

  prerequisiteGraph: publicProcedure.query(async ({ ctx }) => {
    const topics = await ctx.db.query.topic.findMany({
      columns: { id: true, name: true },
      orderBy: (t, { asc }) => [asc(t.spreadsheetRow), asc(t.id)],
    });
    const edges = await ctx.db.query.topicPrerequisite.findMany();
    return {
      nodes: topics,
      edges: edges.map((e) => ({
        from: e.prerequisiteTopicId,
        to: e.topicId,
      })),
    };
  }),

  submitTopicFreeTextSuggestion: protectedProcedure
    .input(
      z.object({
        topicId: z.number(),
        value: z.string().trim().min(1).max(1024),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const topic = await ctx.db.query.topic.findFirst({
        where: (t, { eq }) => eq(t.id, input.topicId),
        columns: { id: true },
      });
      if (!topic) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Topic not found" });
      }

      const [result] = await ctx.db
        .insert(feedbackItem)
        .values({
          userId: ctx.session.user.id,
          topicId: input.topicId,
          transitionId: null,
          type: "free_text",
          freeTextValue: input.value,
          helpfulnessRating: null,
          comment: null,
        })
        .returning({ id: feedbackItem.id });

      return result!;
    }),
});
