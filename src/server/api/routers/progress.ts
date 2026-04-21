import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { buildProgressDays, type ProgressChange } from "./progress.helpers";

export const progressRouter = createTRPCRouter({
  overTime: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;

    const [transitions, bookmarks, excited] = await Promise.all([
      ctx.db.query.levelTransition.findMany({
        where: (t, { eq }) => eq(t.userId, userId),
        orderBy: (t, { asc }) => asc(t.createdAt),
        with: { topic: { columns: { id: true, name: true } } },
      }),
      ctx.db.query.bookmark.findMany({
        where: (b, { eq }) => eq(b.userId, userId),
        columns: { topicId: true },
      }),
      ctx.db.query.excitedToTeach.findMany({
        where: (e, { eq }) => eq(e.userId, userId),
        columns: { topicId: true },
      }),
    ]);

    const bookmarkSet = new Set(bookmarks.map((b) => b.topicId));
    const excitedSet = new Set(excited.map((e) => e.topicId));

    if (transitions.length === 0) {
      return { days: [] };
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

    return { days: buildProgressDays(changes) };
  }),
});
