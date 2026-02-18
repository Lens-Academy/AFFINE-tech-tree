import { z } from "zod";

import { and, eq } from "drizzle-orm";

import { understandingLevelSchema } from "~/shared/understandingLevels";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { userTopicStatus } from "~/server/db/schema";

export const userStatusRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.userTopicStatus.findMany({
      where: (s, { eq }) => eq(s.userId, ctx.session.user.id),
    });
  }),

  set: protectedProcedure
    .input(
      z.object({
        topicId: z.number(),
        level: understandingLevelSchema,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .insert(userTopicStatus)
        .values({
          userId: ctx.session.user.id,
          topicId: input.topicId,
          level: input.level,
        })
        .onConflictDoUpdate({
          target: [userTopicStatus.userId, userTopicStatus.topicId],
          set: {
            level: input.level,
            updatedAt: new Date(),
          },
        });
    }),

  remove: protectedProcedure
    .input(z.object({ topicId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(userTopicStatus)
        .where(
          and(
            eq(userTopicStatus.userId, ctx.session.user.id),
            eq(userTopicStatus.topicId, input.topicId),
          ),
        );
    }),
});
