import { z } from "zod";

import { and, eq } from "drizzle-orm";

import { understandingLevelSchema } from "~/shared/understandingLevels";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { levelTransition, userTopicStatus } from "~/server/db/schema";

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
      const current = await ctx.db.query.userTopicStatus.findFirst({
        where: (s, { and, eq }) =>
          and(eq(s.userId, ctx.session.user.id), eq(s.topicId, input.topicId)),
      });

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

      // Feedback is only requested for real defined-level changes.
      // Transitions involving undefined (first set / clear) are skipped.
      const shouldCreateTransition = !!current && current.level !== input.level;

      let transitionId: number | undefined;
      if (shouldCreateTransition) {
        const [transition] = await ctx.db
          .insert(levelTransition)
          .values({
            userId: ctx.session.user.id,
            topicId: input.topicId,
            fromLevel: current.level,
            toLevel: input.level,
          })
          .returning({ id: levelTransition.id });
        transitionId = transition?.id;
      }

      return { transitionId, isFirstSet: !current };
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

      // Clearing understanding should not produce a feedback transition.
    }),
});
