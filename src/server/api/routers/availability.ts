import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { user } from "~/server/db/schema";

export const availabilityRouter = createTRPCRouter({
  getMyStatus: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, ctx.session.user.id),
      columns: {
        availableForTutoring: true,
      },
    });
    return {
      available: row?.availableForTutoring ?? false,
    };
  }),

  setAvailable: protectedProcedure
    .input(
      z.object({
        available: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({
          availableForTutoring: input.available,
        })
        .where(eq(user.id, ctx.session.user.id));
      return { ok: true };
    }),
});
