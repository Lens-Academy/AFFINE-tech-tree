import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import type { Db } from "~/server/db";
import {
  excitedToTeach,
  topic as topicTable,
  user,
  userTopicStatus,
} from "~/server/db/schema";
import { TEACHER_LEVELS } from "~/shared/understandingLevels";

async function isAdminUser(db: Db, userId: string) {
  const role = await db.query.userRole.findFirst({
    where: (r, { and, eq }) => and(eq(r.userId, userId), eq(r.role, "admin")),
  });
  return !!role;
}

async function getHonorSystemEnabled(db: Db) {
  const row = await db.query.appSetting.findFirst({
    where: (s, { eq }) => eq(s.key, "admin_honor_system_enabled"),
    columns: { value: true },
  });
  return row?.value === "true" || row?.value == null;
}

export const userProfileRouter = createTRPCRouter({
  get: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const isSelf = input.userId === ctx.session.user.id;
      const viewerIsAdmin = await isAdminUser(ctx.db, ctx.session.user.id);

      if (!isSelf && !viewerIsAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can view other users' profiles",
        });
      }

      const targetUser = await ctx.db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, input.userId),
        columns: {
          id: true,
          name: true,
          email: true,
          isApproved: true,
          isNonUser: true,
          availableForTutoring: true,
          segment: true,
          infoPaneClosedVersion: true,
          createdAt: true,
        },
      });

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const targetIsAdmin = await isAdminUser(ctx.db, input.userId);
      const honorSystemEnabled = await getHonorSystemEnabled(ctx.db);

      const excitedTopicRows = await ctx.db
        .select({
          id: topicTable.id,
          name: topicTable.name,
          level: userTopicStatus.level,
        })
        .from(excitedToTeach)
        .innerJoin(topicTable, eq(topicTable.id, excitedToTeach.topicId))
        .innerJoin(
          userTopicStatus,
          and(
            eq(userTopicStatus.userId, excitedToTeach.userId),
            eq(userTopicStatus.topicId, excitedToTeach.topicId),
          ),
        )
        .where(
          and(
            eq(excitedToTeach.userId, input.userId),
            inArray(userTopicStatus.level, [...TEACHER_LEVELS]),
          ),
        )
        .orderBy(topicTable.name);

      // Feedback left about this user by others (type=user, referencedUserId=target)
      const feedbackAboutUser = await ctx.db.query.feedbackItem.findMany({
        where: (fi, { and, eq }) =>
          and(eq(fi.referencedUserId, input.userId), eq(fi.type, "user")),
        with: {
          author: { columns: { id: true, name: true, email: true } },
          topic: { columns: { id: true, name: true } },
          topicLink: { columns: { id: true, title: true } },
        },
        orderBy: (fi, { desc }) => [desc(fi.createdAt)],
      });

      return {
        user: targetUser,
        isAdmin: targetIsAdmin,
        isSelf,
        viewerIsAdmin,
        honorSystemEnabled,
        excitedToTeachTopics: excitedTopicRows,
        feedbackAboutUser: feedbackAboutUser.map((fi) => ({
          id: fi.id,
          helpfulnessRating: fi.helpfulnessRating,
          comment: fi.comment,
          createdAt: fi.createdAt,
          author: fi.author,
          topic: fi.topic,
        })),
      };
    }),

  updateProfile: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        name: z.string().trim().min(1).max(255).optional(),
        email: z.string().trim().email().optional(),
        infoPaneClosedVersion: z.string().max(32).nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const isSelf = input.userId === ctx.session.user.id;
      const viewerIsAdmin = await isAdminUser(ctx.db, ctx.session.user.id);

      if (!isSelf && !viewerIsAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can edit other users' profiles",
        });
      }

      if (input.email !== undefined) {
        // Real users' emails are owned by Discord; changing them here
        // desyncs login. Only allow editing on non-user teacher placeholders
        // (and only admins ever see those rows).
        const target = await ctx.db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, input.userId),
          columns: { isNonUser: true },
        });
        if (!target) {
          throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        }
        if (!target.isNonUser) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Email is managed by Discord and cannot be edited here.",
          });
        }
        if (!viewerIsAdmin) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only admins can edit teacher placeholder emails",
          });
        }
      }

      const set: Partial<{
        name: string;
        email: string;
        infoPaneClosedVersion: string | null;
      }> = {};
      if (input.name) set.name = input.name;
      if (input.email) set.email = input.email;
      if (input.infoPaneClosedVersion !== undefined) {
        set.infoPaneClosedVersion =
          input.infoPaneClosedVersion === ""
            ? null
            : input.infoPaneClosedVersion;
      }

      if (Object.keys(set).length > 0) {
        await ctx.db.update(user).set(set).where(eq(user.id, input.userId));
      }

      return { ok: true };
    }),

  setInfoPaneClosedVersion: protectedProcedure
    .input(z.object({ version: z.string().max(32) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(user)
        .set({ infoPaneClosedVersion: input.version || null })
        .where(eq(user.id, ctx.session.user.id));
      return { ok: true };
    }),
});
