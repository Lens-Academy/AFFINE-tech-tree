import { z } from "zod";

import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  feedbackItemTypeSchema,
  helpfulnessRatingSchema,
} from "~/shared/feedbackTypes";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { feedbackItem } from "~/server/db/schema";

export const feedbackRouter = createTRPCRouter({
  getRecentTransitions: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.query.levelTransition.findMany({
      where: (t, { eq }) => eq(t.userId, ctx.session.user.id),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
      limit: 20,
      with: {
        topic: { columns: { id: true, name: true } },
        feedbackItems: { columns: { id: true } },
      },
    });
  }),

  getTransitionsByTopic: protectedProcedure
    .input(z.object({ topicId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.levelTransition.findMany({
        where: (t, { and, eq }) =>
          and(eq(t.userId, ctx.session.user.id), eq(t.topicId, input.topicId)),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        with: {
          feedbackItems: {
            with: {
              topicLink: true,
              referencedUser: {
                columns: { id: true, name: true, email: true },
              },
            },
          },
        },
      });
    }),

  upsertFeedbackItem: protectedProcedure
    .input(
      z.object({
        id: z.number().optional(),
        transitionId: z.number(),
        type: feedbackItemTypeSchema,
        topicLinkId: z.number().nullable().optional(),
        referencedUserId: z.string().nullable().optional(),
        freeTextValue: z.string().nullable().optional(),
        helpfulnessRating: helpfulnessRatingSchema.nullable().optional(),
        comment: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const transition = await ctx.db.query.levelTransition.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.id, input.transitionId), eq(t.userId, ctx.session.user.id)),
      });

      if (!transition) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Transition not found or unauthorized",
        });
      }

      const itemId = input.id;
      if (itemId != null) {
        const existing = await ctx.db.query.feedbackItem.findFirst({
          where: (fi, { eq }) => eq(fi.id, itemId),
          with: { transition: true },
        });
        if (existing?.transition.userId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Feedback item not found or unauthorized",
          });
        }
        if (existing.transitionId !== input.transitionId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Feedback item transition mismatch",
          });
        }

        const updateData: Partial<typeof feedbackItem.$inferInsert> = {};
        if (input.helpfulnessRating !== undefined) {
          updateData.helpfulnessRating = input.helpfulnessRating;
        }
        if (input.comment !== undefined) {
          updateData.comment = input.comment;
        }
        if (Object.keys(updateData).length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No feedback fields to update",
          });
        }

        await ctx.db
          .update(feedbackItem)
          .set(updateData)
          .where(eq(feedbackItem.id, itemId));

        return { id: itemId };
      }

      const [result] = await ctx.db
        .insert(feedbackItem)
        .values({
          transitionId: input.transitionId,
          type: input.type,
          topicLinkId: input.topicLinkId ?? null,
          referencedUserId: input.referencedUserId ?? null,
          freeTextValue: input.freeTextValue ?? null,
          helpfulnessRating: input.helpfulnessRating,
          comment: input.comment ?? null,
        })
        .returning({ id: feedbackItem.id });

      return result!;
    }),

  deleteFeedbackItem: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.feedbackItem.findFirst({
        where: (fi, { eq }) => eq(fi.id, input.id),
        with: { transition: true },
      });

      if (item?.transition.userId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Feedback item not found or unauthorized",
        });
      }

      await ctx.db.delete(feedbackItem).where(eq(feedbackItem.id, input.id));
    }),
});
