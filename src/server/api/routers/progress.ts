import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { isAdminUser } from "~/server/approvalPolicy";
import { emptyUnderstandingLevelCounts } from "~/shared/understandingLevels";
import { buildProgressDays, type ProgressChange } from "./progress.helpers";

export const progressRouter = createTRPCRouter({
  overTime: protectedProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const isSelf = input.userId === ctx.session.user.id;
      const viewerIsAdmin = await isAdminUser(ctx.db, ctx.session.user.id);

      if (!isSelf && !viewerIsAdmin) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can view other users' progress",
        });
      }

      const targetUser = await ctx.db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, input.userId),
        columns: { id: true, name: true, email: true },
      });

      if (!targetUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const [transitions, bookmarks, excited, statuses] = await Promise.all([
        ctx.db.query.levelTransition.findMany({
          where: (t, { eq }) => eq(t.userId, input.userId),
          orderBy: (t, { asc }) => asc(t.createdAt),
          with: { topic: { columns: { id: true, name: true } } },
        }),
        ctx.db.query.bookmark.findMany({
          where: (b, { eq }) => eq(b.userId, input.userId),
          columns: { topicId: true },
        }),
        ctx.db.query.excitedToTeach.findMany({
          where: (e, { eq }) => eq(e.userId, input.userId),
          columns: { topicId: true },
        }),
        ctx.db.query.userTopicStatus.findMany({
          where: (s, { eq }) => eq(s.userId, input.userId),
          columns: { level: true },
        }),
      ]);

      const bookmarkSet = new Set(bookmarks.map((b) => b.topicId));
      const excitedSet = new Set(excited.map((e) => e.topicId));

      const currentCounts = emptyUnderstandingLevelCounts();
      for (const status of statuses) {
        currentCounts[status.level]++;
      }

      const changes: ProgressChange[] = transitions.map((t) => ({
        at: t.createdAt,
        topicId: t.topicId,
        topicName: t.topic.name,
        from: t.fromLevel,
        to: t.toLevel,
        isBookmarked: bookmarkSet.has(t.topicId),
        isExcited: excitedSet.has(t.topicId),
      }));

      return { user: targetUser, days: buildProgressDays(changes, currentCounts) };
    }),
});
