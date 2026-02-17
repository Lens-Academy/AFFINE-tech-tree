import { z } from "zod";

import { and, eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { bookmark } from "~/server/db/schema";

export const bookmarkRouter = createTRPCRouter({
  getAll: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.bookmark.findMany({
      where: (b, { eq }) => eq(b.userId, ctx.session.user.id),
      columns: { topicId: true },
    });
    return rows.map((r) => r.topicId);
  }),

  set: protectedProcedure
    .input(z.object({ topicId: z.number(), bookmarked: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      if (input.bookmarked) {
        await ctx.db
          .insert(bookmark)
          .values({
            userId: ctx.session.user.id,
            topicId: input.topicId,
          })
          .onConflictDoNothing();

        return { bookmarked: true };
      }

      await ctx.db
        .delete(bookmark)
        .where(
          and(
            eq(bookmark.userId, ctx.session.user.id),
            eq(bookmark.topicId, input.topicId),
          ),
        );

      return { bookmarked: false };
    }),
});
