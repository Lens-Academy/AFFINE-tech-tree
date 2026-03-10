import { z } from "zod";

import { TRPCError } from "@trpc/server";
import { TEACHER_LEVELS } from "~/shared/understandingLevels";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { feedbackItem } from "~/server/db/schema";

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
      return ctx.db.query.topic.findFirst({
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
          resources: true,
        },
      });
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
          user: { columns: { id: true, name: true } },
        },
      });
      return rows.map((r) => ({
        userId: r.user.id,
        name: r.user.name,
        level: r.level,
      }));
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
