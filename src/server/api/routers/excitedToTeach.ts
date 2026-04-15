import { z } from "zod";

import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { excitedToTeach } from "~/server/db/schema";
import { isTeacherLevel } from "~/shared/understandingLevels";

export const excitedToTeachRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.excitedToTeach.findMany({
      where: (e, { eq }) => eq(e.userId, ctx.session.user.id),
      columns: { topicId: true },
    });
    return rows.map((r) => r.topicId);
  }),

  set: protectedProcedure
    .input(z.object({ topicId: z.number(), excited: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.excited) {
        const currentStatus = await ctx.db.query.userTopicStatus.findFirst({
          where: (s, { and, eq }) =>
            and(
              eq(s.userId, ctx.session.user.id),
              eq(s.topicId, input.topicId),
            ),
          columns: { level: true },
        });
        if (!isTeacherLevel(currentStatus?.level)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "You can only star topics that you can teach",
          });
        }

        await ctx.db
          .insert(excitedToTeach)
          .values({
            userId: ctx.session.user.id,
            topicId: input.topicId,
          })
          .onConflictDoNothing();

        return { excited: true };
      }

      await ctx.db
        .delete(excitedToTeach)
        .where(
          and(
            eq(excitedToTeach.userId, ctx.session.user.id),
            eq(excitedToTeach.topicId, input.topicId),
          ),
        );

      return { excited: false };
    }),
});
