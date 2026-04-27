import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { matchRequest } from "~/server/db/schema";
import {
  isTeacherLevel,
  type UnderstandingLevel,
} from "~/shared/understandingLevels";

function getMatchPairKey(leftUserId: string, rightUserId: string): string {
  return leftUserId < rightUserId
    ? `${leftUserId}:${rightUserId}`
    : `${rightUserId}:${leftUserId}`;
}

export const matchRouter = createTRPCRouter({
  listPeersInSegment: protectedProcedure.query(async ({ ctx }) => {
    const viewer = await ctx.db.query.user.findFirst({
      where: (u, { eq }) => eq(u.id, ctx.session.user.id),
      columns: { id: true, segment: true },
    });
    if (!viewer?.segment) {
      return { segment: null, peers: [] as const };
    }

    const peers = await ctx.db.query.user.findMany({
      where: (u, { and, eq, ne }) =>
        and(
          eq(u.segment, viewer.segment!),
          ne(u.id, viewer.id),
          eq(u.isNonUser, false),
          eq(u.isApproved, true),
        ),
      columns: {
        id: true,
        name: true,
        email: true,
        availableForTutoring: true,
      },
      with: {
        excitedToTeach: {
          columns: { topicId: true },
          with: {
            topic: { columns: { id: true, name: true } },
          },
        },
      },
      orderBy: (u, { desc, asc }) => [
        desc(u.availableForTutoring),
        asc(u.name),
        asc(u.email),
      ],
    });

    const peerIds = peers.map((peer) => peer.id);
    const relationshipRows =
      peerIds.length === 0
        ? []
        : await ctx.db.query.matchRequest.findMany({
            where: and(
              or(
                eq(matchRequest.fromUserId, viewer.id),
                eq(matchRequest.toUserId, viewer.id),
              ),
              or(
                inArray(matchRequest.fromUserId, peerIds),
                inArray(matchRequest.toUserId, peerIds),
              ),
            ),
          });
    const relationshipsByPair = new Map(
      relationshipRows.map((row) => [row.pairKey, row]),
    );

    return {
      segment: viewer.segment,
      peers: peers.map((p) => {
        const relationship = relationshipsByPair.get(
          getMatchPairKey(viewer.id, p.id),
        );

        let matchState = "none" as
          | "none"
          | "pending_outgoing"
          | "pending_incoming"
          | "accepted";
        let matchId: number | null = null;
        if (relationship?.status === "accepted") {
          matchState = "accepted";
          matchId = relationship.id;
        } else if (relationship?.status === "pending") {
          matchState =
            relationship.fromUserId === viewer.id
              ? "pending_outgoing"
              : "pending_incoming";
        }

        return {
          id: p.id,
          name: p.name,
          email: p.email,
          availableForTutoring: p.availableForTutoring,
          matchState,
          matchId,
          starredTopics: p.excitedToTeach.map((e) => ({
            id: e.topic.id,
            name: e.topic.name,
          })),
        };
      }),
    };
  }),

  sendRequest: protectedProcedure
    .input(z.object({ toUserId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const fromUserId = ctx.session.user.id;
      const pairKey = getMatchPairKey(fromUserId, input.toUserId);
      if (input.toUserId === fromUserId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot match with yourself",
        });
      }

      const [viewer, target] = await Promise.all([
        ctx.db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, fromUserId),
          columns: { segment: true },
        }),
        ctx.db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, input.toUserId),
          columns: { segment: true, isNonUser: true, isApproved: true },
        }),
      ]);
      if (!viewer?.segment) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You must be assigned to a segment first",
        });
      }
      if (
        target?.segment !== viewer.segment ||
        target.isNonUser ||
        !target.isApproved
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Peer not found in your segment",
        });
      }

      const existing = await ctx.db.query.matchRequest.findFirst({
        where: (m, { eq }) => eq(m.pairKey, pairKey),
      });
      if (existing?.status === "pending") {
        return { id: existing.id, alreadyPending: true };
      }
      if (existing?.status === "accepted") {
        return { id: existing.id, alreadyAccepted: true };
      }
      if (existing?.status === "declined") {
        await ctx.db
          .update(matchRequest)
          .set({
            fromUserId,
            toUserId: input.toUserId,
            pairKey,
            status: "pending",
            createdAt: new Date(),
            respondedAt: null,
          })
          .where(eq(matchRequest.id, existing.id));
        return { id: existing.id, alreadyPending: false };
      }

      try {
        const [created] = await ctx.db
          .insert(matchRequest)
          .values({
            fromUserId,
            toUserId: input.toUserId,
            pairKey,
            status: "pending",
          })
          .returning({ id: matchRequest.id });
        return { id: created!.id, alreadyPending: false };
      } catch (error) {
        const conflict = await ctx.db.query.matchRequest.findFirst({
          where: (m, { eq }) => eq(m.pairKey, pairKey),
        });
        if (conflict?.status === "accepted") {
          return { id: conflict.id, alreadyAccepted: true };
        }
        if (conflict?.status === "pending") {
          return { id: conflict.id, alreadyPending: true };
        }
        throw error;
      }
    }),

  respondToRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.number().int().positive(),
        accept: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.query.matchRequest.findFirst({
        where: (m, { eq }) => eq(m.id, input.requestId),
      });
      if (req?.toUserId !== ctx.session.user.id) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Match request not found",
        });
      }
      if (req.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This request has already been responded to",
        });
      }
      await ctx.db
        .update(matchRequest)
        .set({
          status: input.accept ? "accepted" : "declined",
          respondedAt: new Date(),
        })
        .where(eq(matchRequest.id, input.requestId));
      return { ok: true };
    }),

  listIncoming: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.query.matchRequest.findMany({
      where: (m, { and, eq }) =>
        and(eq(m.toUserId, ctx.session.user.id), eq(m.status, "pending")),
      with: {
        fromUser: {
          columns: {
            id: true,
            name: true,
            email: true,
            availableForTutoring: true,
          },
        },
      },
      orderBy: (m) => [desc(m.createdAt)],
    });
    return rows;
  }),

  listMatches: protectedProcedure.query(async ({ ctx }) => {
    const viewerId = ctx.session.user.id;
    const rows = await ctx.db.query.matchRequest.findMany({
      where: (m, { and, or, eq }) =>
        and(
          eq(m.status, "accepted"),
          or(eq(m.fromUserId, viewerId), eq(m.toUserId, viewerId)),
        ),
      with: {
        fromUser: {
          columns: {
            id: true,
            name: true,
            email: true,
            availableForTutoring: true,
          },
        },
        toUser: {
          columns: {
            id: true,
            name: true,
            email: true,
            availableForTutoring: true,
          },
        },
      },
      orderBy: (m) => [desc(m.respondedAt)],
    });
    return rows.map((r) => {
      const other = r.fromUserId === viewerId ? r.toUser : r.fromUser;
      return { id: r.id, other, respondedAt: r.respondedAt };
    });
  }),

  getMatchTopics: protectedProcedure
    .input(z.object({ matchId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id;
      const match = await ctx.db.query.matchRequest.findFirst({
        where: (m, { eq }) => eq(m.id, input.matchId),
      });
      if (
        match?.status !== "accepted" ||
        (match.fromUserId !== viewerId && match.toUserId !== viewerId)
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Match not found",
        });
      }
      const otherId =
        match.fromUserId === viewerId ? match.toUserId : match.fromUserId;

      const [viewerUser, otherUser] = await Promise.all([
        ctx.db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, viewerId),
          columns: { id: true, name: true, email: true },
        }),
        ctx.db.query.user.findFirst({
          where: (u, { eq }) => eq(u.id, otherId),
          columns: { id: true, name: true, email: true },
        }),
      ]);
      if (!viewerUser || !otherUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const statusRows = await ctx.db.query.userTopicStatus.findMany({
        where: (s, { inArray }) => inArray(s.userId, [viewerId, otherId]),
        columns: { userId: true, topicId: true, level: true },
        with: {
          topic: {
            columns: {
              id: true,
              name: true,
              spreadsheetRow: true,
              importance: true,
            },
          },
        },
      });
      const bookmarkRows = await ctx.db.query.bookmark.findMany({
        where: (b, { inArray }) => inArray(b.userId, [viewerId, otherId]),
        columns: { userId: true, topicId: true },
      });
      const starredRows = await ctx.db.query.excitedToTeach.findMany({
        where: (e, { inArray }) => inArray(e.userId, [viewerId, otherId]),
        columns: { userId: true, topicId: true },
      });

      type PerTopic = {
        topicId: number;
        name: string;
        spreadsheetRow: number | null;
        importance: number;
        levels: Record<string, UnderstandingLevel | undefined>;
      };
      const topicsById = new Map<number, PerTopic>();
      for (const row of statusRows) {
        const existing = topicsById.get(row.topicId) ?? {
          topicId: row.topicId,
          name: row.topic.name,
          spreadsheetRow: row.topic.spreadsheetRow,
          importance: row.topic.importance,
          levels: {},
        };
        existing.levels[row.userId] = row.level;
        topicsById.set(row.topicId, existing);
      }

      const bookmarkedBy = new Set(
        bookmarkRows.map((r) => `${r.userId}:${r.topicId}`),
      );
      const starredBy = new Set(
        starredRows.map((r) => `${r.userId}:${r.topicId}`),
      );

      type Entry = {
        topicId: number;
        name: string;
        teacherId: string;
        teacherName: string;
        learnerId: string;
        learnerName: string;
        teacherLevel: UnderstandingLevel;
        learnerLevel: UnderstandingLevel | null;
        learnerBookmarked: boolean;
        teacherStarred: boolean;
        teacherAdvanced: boolean;
        importance: number;
        spreadsheetRow: number | null;
      };

      const displayName = (u: { name: string | null; email: string }) =>
        u.name ?? u.email;

      const entries: Entry[] = [];
      for (const t of topicsById.values()) {
        const viewerLevel = t.levels[viewerId];
        const otherLevel = t.levels[otherId];
        const viewerTeacher = isTeacherLevel(viewerLevel);
        const otherTeacher = isTeacherLevel(otherLevel);
        // Must be exactly one teacher side.
        if (viewerTeacher === otherTeacher) continue;

        const teacherId = viewerTeacher ? viewerId : otherId;
        const learnerId = viewerTeacher ? otherId : viewerId;
        const teacherLevel = (viewerTeacher ? viewerLevel : otherLevel)!;
        const learnerLevel = (viewerTeacher ? otherLevel : viewerLevel) ?? null;

        entries.push({
          topicId: t.topicId,
          name: t.name,
          teacherId,
          teacherName: displayName(
            teacherId === viewerId ? viewerUser : otherUser,
          ),
          learnerId,
          learnerName: displayName(
            learnerId === viewerId ? viewerUser : otherUser,
          ),
          teacherLevel,
          learnerLevel,
          learnerBookmarked: bookmarkedBy.has(`${learnerId}:${t.topicId}`),
          teacherStarred: starredBy.has(`${teacherId}:${t.topicId}`),
          teacherAdvanced: teacherLevel === "advanced_questions_welcome",
          importance: t.importance,
          spreadsheetRow: t.spreadsheetRow,
        });
      }

      entries.sort((a, b) => {
        if (a.learnerBookmarked !== b.learnerBookmarked) {
          return a.learnerBookmarked ? -1 : 1;
        }
        if (a.teacherStarred !== b.teacherStarred) {
          return a.teacherStarred ? -1 : 1;
        }
        if (a.teacherAdvanced !== b.teacherAdvanced) {
          return a.teacherAdvanced ? -1 : 1;
        }
        if (a.importance !== b.importance) return b.importance - a.importance;
        const ar = a.spreadsheetRow ?? Number.MAX_SAFE_INTEGER;
        const br = b.spreadsheetRow ?? Number.MAX_SAFE_INTEGER;
        if (ar !== br) return ar - br;
        return a.name.localeCompare(b.name);
      });

      const meetingPoint =
        match.meetX !== null && match.meetY !== null
          ? {
              x: match.meetX,
              y: match.meetY,
              updatedAt: match.meetUpdatedAt,
              updatedBy: match.meetUpdatedBy,
            }
          : null;

      return {
        otherUser,
        entries,
        meetingPoint,
      };
    }),

  setMeetingPoint: protectedProcedure
    .input(
      z.object({
        matchId: z.number().int().positive(),
        point: z
          .object({
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
          })
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const viewerId = ctx.session.user.id;
      const match = await ctx.db.query.matchRequest.findFirst({
        where: (m, { eq }) => eq(m.id, input.matchId),
      });
      if (
        match?.status !== "accepted" ||
        (match.fromUserId !== viewerId && match.toUserId !== viewerId)
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Match not found",
        });
      }
      await ctx.db
        .update(matchRequest)
        .set({
          meetX: input.point?.x ?? null,
          meetY: input.point?.y ?? null,
          meetUpdatedAt: input.point ? new Date() : null,
          meetUpdatedBy: input.point ? viewerId : null,
        })
        .where(eq(matchRequest.id, input.matchId));
      return { ok: true };
    }),
});
