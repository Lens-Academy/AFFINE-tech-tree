import { z } from "zod";

import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import {
  feedbackItemTypeSchema,
  helpfulnessRatingSchema,
  SKIP_FEEDBACK_SENTINEL,
} from "~/shared/feedbackTypes";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { Db } from "~/server/db";
import { feedbackItem, topicLink } from "~/server/db/schema";
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
  });
  if (item?.userId !== args.userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Feedback item not found or unauthorized",
    });
  }
  return item;
}

export const feedbackRouter = createTRPCRouter({
  getAdHocFeedbackByTopic: protectedProcedure
    .input(z.object({ topicId: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.query.feedbackItem.findMany({
        where: (fi, { eq: e }) =>
          and(
            e(fi.userId, ctx.session.user.id),
            e(fi.topicId, input.topicId),
            isNull(fi.transitionId),
          ),
        with: {
          topicLink: true,
          referencedUser: {
            columns: { id: true, name: true, email: true },
          },
        },
      });
    }),

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
        topicId: z.number(),
        transitionId: z.number().nullable().optional(),
        type: feedbackItemTypeSchema,
        topicLinkId: z.number().nullable().optional(),
        referencedUserId: z.string().nullable().optional(),
        freeTextValue: z.string().nullable().optional(),
        helpfulnessRating: helpfulnessRatingSchema.nullable().optional(),
        comment: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const baseScope = {
        userId: ctx.session.user.id,
        topicId: input.topicId,
        transitionId: input.transitionId ?? null,
      };

      if (input.transitionId) {
        const transition = await ctx.db.query.levelTransition.findFirst({
          where: (t, { and, eq }) =>
            and(
              eq(t.id, input.transitionId!),
              eq(t.userId, ctx.session.user.id),
            ),
        });
        if (!transition) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Transition not found or unauthorized",
          });
        }
      }

      const itemId = input.id;
      const updateData: Partial<typeof feedbackItem.$inferInsert> = {};
      if (input.helpfulnessRating !== undefined) {
        updateData.helpfulnessRating = input.helpfulnessRating;
      }
      if (input.comment !== undefined) {
        updateData.comment = input.comment;
      }

      if (itemId != null) {
        const existing = await ctx.db.query.feedbackItem.findFirst({
          where: (fi, { eq }) => eq(fi.id, itemId),
        });
        if (existing?.userId !== ctx.session.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Feedback item not found or unauthorized",
          });
        }
        if (
          input.transitionId &&
          existing.transitionId !== input.transitionId
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Feedback item transition mismatch",
          });
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

      // UI can trigger multiple saves before it receives the freshly created id.
      // For resource/user feedback rows, treat those saves as updates to one row.
      if (input.type === "resource" && input.topicLinkId != null) {
        const existing = await ctx.db.query.feedbackItem.findFirst({
          where: (fi, { and, eq, isNull }) =>
            and(
              eq(fi.userId, baseScope.userId),
              eq(fi.topicId, baseScope.topicId),
              baseScope.transitionId == null
                ? isNull(fi.transitionId)
                : eq(fi.transitionId, baseScope.transitionId),
              eq(fi.type, "resource"),
              eq(fi.topicLinkId, input.topicLinkId!),
            ),
          columns: { id: true },
        });
        if (existing) {
          if (Object.keys(updateData).length > 0) {
            await ctx.db
              .update(feedbackItem)
              .set(updateData)
              .where(eq(feedbackItem.id, existing.id));
          }
          return { id: existing.id };
        }
      }

      if (input.type === "user" && input.referencedUserId != null) {
        const existing = await ctx.db.query.feedbackItem.findFirst({
          where: (fi, { and, eq, isNull }) =>
            and(
              eq(fi.userId, baseScope.userId),
              eq(fi.topicId, baseScope.topicId),
              baseScope.transitionId == null
                ? isNull(fi.transitionId)
                : eq(fi.transitionId, baseScope.transitionId),
              eq(fi.type, "user"),
              eq(fi.referencedUserId, input.referencedUserId!),
            ),
          columns: { id: true },
        });
        if (existing) {
          if (Object.keys(updateData).length > 0) {
            await ctx.db
              .update(feedbackItem)
              .set(updateData)
              .where(eq(feedbackItem.id, existing.id));
          }
          return { id: existing.id };
        }
      }

      const [result] = await ctx.db
        .insert(feedbackItem)
        .values({
          userId: ctx.session.user.id,
          topicId: input.topicId,
          transitionId: input.transitionId ?? null,
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
          topicId: input.topicId,
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

  skipTransitionFeedback: protectedProcedure
    .input(z.object({ transitionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const transition = await ctx.db.query.levelTransition.findFirst({
        where: (t, { and, eq }) =>
          and(eq(t.id, input.transitionId), eq(t.userId, ctx.session.user.id)),
        columns: { id: true, userId: true, topicId: true },
      });
      if (!transition) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Transition not found or unauthorized",
        });
      }

      const existingItem = await ctx.db.query.feedbackItem.findFirst({
        where: (fi, { eq }) => eq(fi.transitionId, input.transitionId),
        columns: { id: true },
      });
      if (existingItem) {
        return { id: existingItem.id };
      }

      const [result] = await ctx.db
        .insert(feedbackItem)
        .values({
          userId: transition.userId,
          topicId: transition.topicId,
          transitionId: input.transitionId,
          type: "free_text",
          topicLinkId: null,
          referencedUserId: null,
          freeTextValue: SKIP_FEEDBACK_SENTINEL,
          helpfulnessRating: null,
          comment: null,
        })
        .returning({ id: feedbackItem.id });

      return result!;
    }),

  deleteFeedbackItem: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.query.feedbackItem.findFirst({
        where: (fi, { eq }) => eq(fi.id, input.id),
      });

      if (item?.userId !== ctx.session.user.id) {
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
        where: (tl, { eq }) => eq(tl.topicId, item.topicId),
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
            topicId: item.topicId,
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
