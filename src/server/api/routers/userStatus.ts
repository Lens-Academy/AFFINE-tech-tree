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

      const [transition] = await ctx.db
        .insert(levelTransition)
        .values({
          userId: ctx.session.user.id,
          topicId: input.topicId,
          fromLevel: current?.level ?? null,
          toLevel: input.level,
        })
        .returning({ id: levelTransition.id });

      return { transitionId: transition?.id, isFirstSet: !current };
    }),

  remove: protectedProcedure
    .input(z.object({ topicId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.query.userTopicStatus.findFirst({
        where: (s, { and, eq }) =>
          and(eq(s.userId, ctx.session.user.id), eq(s.topicId, input.topicId)),
      });

      await ctx.db
        .delete(userTopicStatus)
        .where(
          and(
            eq(userTopicStatus.userId, ctx.session.user.id),
            eq(userTopicStatus.topicId, input.topicId),
          ),
        );

      if (current) {
        await ctx.db.insert(levelTransition).values({
          userId: ctx.session.user.id,
          topicId: input.topicId,
          fromLevel: current.level,
          toLevel: null,
        });
      }
    }),
});
