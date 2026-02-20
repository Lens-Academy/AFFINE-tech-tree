import { z } from "zod";

import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  feedbackItemTypeSchema,
  helpfulnessRatingSchema,
} from "~/shared/feedbackTypes";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { Db } from "~/server/db";
import { feedbackItem, levelTransition, topicLink } from "~/server/db/schema";
import { normalizeUrl } from "~/server/urlUtils";

function extractEmailCandidate(input: string): string | null {
  const value = input.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

async function inferFreeTextLinkTargets(args: {
  db: Db;
  topicId: number;
  freeTextValue: string;
}) {
  const raw = args.freeTextValue.trim();
  const normalizedUrl = normalizeUrl(raw);
  let matchedTopicLinkId: number | null = null;
  let matchedUserId: string | null = null;
  let nextType: "resource" | "user" | "free_text" = "free_text";

  if (normalizedUrl) {
    const links = await args.db.query.topicLink.findMany({
      where: (tl, { eq }) => eq(tl.topicId, args.topicId),
      columns: { id: true, url: true },
    });
    const matched = links.find((link) => {
      if (!link.url) return false;
      return normalizeUrl(link.url) === normalizedUrl;
    });
    if (matched) {
      matchedTopicLinkId = matched.id;
      nextType = "resource";
    }
  }

  if (!matchedTopicLinkId) {
    const email = extractEmailCandidate(raw);
    if (email) {
      const found = await args.db.query.user.findFirst({
        where: (u, { eq }) => eq(u.email, email),
        columns: { id: true },
      });
      if (found) {
        matchedUserId = found.id;
        nextType = "user";
      }
    }
  }

  if (!matchedTopicLinkId && !matchedUserId) {
    const lowerName = raw.toLowerCase();
    const possibleUsers = await args.db.query.user.findMany({
      where: (u, { eq }) => eq(u.isNonUser, false),
      columns: { id: true, name: true },
    });
    const exactNameMatches = possibleUsers.filter(
      (u) => u.name?.trim().toLowerCase() === lowerName,
    );
    if (exactNameMatches.length === 1) {
      matchedUserId = exactNameMatches[0]!.id;
      nextType = "user";
    }
  }

  return {
    topicLinkId: matchedTopicLinkId,
    referencedUserId: matchedUserId,
    type: nextType,
  };
}

async function assertFeedbackItemOwner(args: {
  db: Db;
  feedbackItemId: number;
  userId: string;
}) {
  const item = await args.db.query.feedbackItem.findFirst({
    where: (fi, { eq }) => eq(fi.id, args.feedbackItemId),
    with: { transition: true },
  });
  if (item?.transition.userId !== args.userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Feedback item not found or unauthorized",
    });
  }
  return item;
}

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

  submitTopicFreeTextSuggestion: protectedProcedure
    .input(
      z.object({
        topicId: z.number(),
        value: z.string().trim().min(1).max(1024),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const latestTransition = await ctx.db.query.levelTransition.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.userId, ctx.session.user.id), eq(t.topicId, input.topicId)),
        orderBy: (t, { desc }) => [desc(t.createdAt), desc(t.id)],
        columns: { id: true },
      });

      let transitionId = latestTransition?.id;
      if (!transitionId) {
        const [createdTransition] = await ctx.db
          .insert(levelTransition)
          .values({
            userId: ctx.session.user.id,
            topicId: input.topicId,
            fromLevel: null,
            toLevel: null,
          })
          .returning({ id: levelTransition.id });
        transitionId = createdTransition?.id;
      }

      if (!transitionId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create transition for feedback suggestion",
        });
      }

      const [result] = await ctx.db
        .insert(feedbackItem)
        .values({
          transitionId,
          type: "free_text",
          freeTextValue: input.value,
          helpfulnessRating: null,
          comment: null,
        })
        .returning({ id: feedbackItem.id });

      return result!;
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

      if (input.type === "free_text" && input.freeTextValue?.trim()) {
        const inferred = await inferFreeTextLinkTargets({
          db: ctx.db,
          topicId: transition.topicId,
          freeTextValue: input.freeTextValue,
        });
        if (inferred.topicLinkId || inferred.referencedUserId) {
          await ctx.db
            .update(feedbackItem)
            .set({
              topicLinkId: inferred.topicLinkId,
              referencedUserId: inferred.referencedUserId,
              type: inferred.type,
            })
            .where(eq(feedbackItem.id, result!.id));
        }
      }

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

  promoteFreeTextToTopicLink: protectedProcedure
    .input(
      z.object({
        feedbackItemId: z.number(),
        title: z.string().trim().min(1).max(512).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await assertFeedbackItemOwner({
        db: ctx.db,
        feedbackItemId: input.feedbackItemId,
        userId: ctx.session.user.id,
      });
      if (item.type !== "free_text" || !item.freeTextValue) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only free-text items can be promoted",
        });
      }
      const normalized = normalizeUrl(item.freeTextValue);
      if (!normalized) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Free-text value is not a valid URL",
        });
      }

      const existingLinks = await ctx.db.query.topicLink.findMany({
        where: (tl, { eq }) => eq(tl.topicId, item.transition.topicId),
        columns: { id: true, url: true, position: true },
      });
      const existing = existingLinks.find(
        (link) => link.url && normalizeUrl(link.url) === normalized,
      );

      let topicLinkId = existing?.id;
      if (!topicLinkId) {
        const nextPosition =
          existingLinks.reduce(
            (maxPos, link) => Math.max(maxPos, link.position),
            -1,
          ) + 1;
        const [created] = await ctx.db
          .insert(topicLink)
          .values({
            topicId: item.transition.topicId,
            title: input.title ?? item.freeTextValue,
            url: normalized,
            position: nextPosition,
          })
          .returning({ id: topicLink.id });
        topicLinkId = created!.id;
      }

      await ctx.db
        .update(feedbackItem)
        .set({
          type: "resource",
          topicLinkId,
        })
        .where(eq(feedbackItem.id, input.feedbackItemId));

      return { topicLinkId };
    }),
});
