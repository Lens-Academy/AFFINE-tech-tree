import { z } from "zod";
import { eq } from "drizzle-orm";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { user } from "~/server/db/schema";

const setAvailableInputSchema = z
  .object({
    available: z.boolean(),
    latitude: z.number().finite().min(-90).max(90).nullable(),
    longitude: z.number().finite().min(-180).max(180).nullable(),
  })
  .superRefine((input, ctx) => {
    if (
      input.available &&
      (input.latitude == null || input.longitude == null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Latitude and longitude are required when available is true",
      });
    }

    if (
      !input.available &&
      (input.latitude != null || input.longitude != null)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Latitude and longitude must be null when available is false",
      });
    }
  });

export const availabilityRouter = createTRPCRouter({
  getMyStatus: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, ctx.session.user.id),
      columns: {
        availableForTutoring: true,
        latitude: true,
        longitude: true,
        locationUpdatedAt: true,
      },
    });
    return {
      available: row?.availableForTutoring ?? false,
      latitude: row?.latitude ?? null,
      longitude: row?.longitude ?? null,
      locationUpdatedAt: row?.locationUpdatedAt ?? null,
    };
  }),

  setAvailable: protectedProcedure
    .input(setAvailableInputSchema)
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({
          availableForTutoring: input.available,
          latitude: input.available ? input.latitude : null,
          longitude: input.available ? input.longitude : null,
          locationUpdatedAt: input.available ? new Date() : null,
        })
        .where(eq(user.id, ctx.session.user.id));
      return { ok: true };
    }),
});
