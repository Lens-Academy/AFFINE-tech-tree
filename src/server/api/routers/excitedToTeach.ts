import { z } from "zod";

import { and, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { excitedToTeach } from "~/server/db/schema";

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
