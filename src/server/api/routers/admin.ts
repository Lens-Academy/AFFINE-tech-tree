import { TRPCError } from "@trpc/server";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";

import { auth } from "~/server/better-auth";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import type { Db } from "~/server/db";
import { normalizeUrl } from "~/server/urlUtils";
import {
  adminActionLog,
  appSetting,
  user,
  userRole,
  userTopicStatus,
  levelTransition,
  bookmark,
  feedbackItem,
  topicLink,
  resource,
  teachingSession,
} from "~/server/db/schema";
import type { UnderstandingLevel } from "~/shared/understandingLevels";
import { UNDERSTANDING_LEVELS } from "~/shared/understandingLevels";

const ADMIN_HONOR_SYSTEM_KEY = "admin_honor_system_enabled";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function similarityScore(haystack: string, needle: string): number {
  const a = haystack.toLowerCase();
  const b = needle.toLowerCase();
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b)) return 0.8;
  if (b.includes(a)) return 0.7;
  const aTokens = new Set(a.split(/[\s._\-/:]+/).filter(Boolean));
  const bTokens = new Set(b.split(/[\s._\-/:]+/).filter(Boolean));
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap++;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
}

function parseBooleanSetting(raw: string | undefined, fallback: boolean) {
  if (raw == null) return fallback;
  return raw === "true";
}

async function isAdminUser(db: Db, userId: string) {
  const role = await db.query.userRole.findFirst({
    where: (r, { and, eq }) => and(eq(r.userId, userId), eq(r.role, "admin")),
  });
  return !!role;
}

async function getHonorSystemEnabled(db: Db) {
  const row = await db.query.appSetting.findFirst({
    where: (s, { eq }) => eq(s.key, ADMIN_HONOR_SYSTEM_KEY),
    columns: { value: true },
  });
  return parseBooleanSetting(row?.value, true);
}

async function assertAdmin(ctx: { db: Db; session: { user: { id: string } } }) {
  const admin = await isAdminUser(ctx.db, ctx.session.user.id);
  if (!admin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Admin access required",
    });
  }
}

async function logAdminAction(ctx: {
  db: Db;
  actorUserId: string;
  action: string;
  targetType: string;
  targetId?: string | null;
  payload?: Record<string, unknown>;
}) {
  await ctx.db.insert(adminActionLog).values({
    actorUserId: ctx.actorUserId,
    action: ctx.action,
    targetType: ctx.targetType,
    targetId: ctx.targetId ?? null,
    payloadJson: JSON.stringify(ctx.payload ?? {}),
  });
}

export const adminRouter = createTRPCRouter({
  getAdminStatus: protectedProcedure.query(async ({ ctx }) => {
    const [adminCountRow] = await ctx.db
      .select({ value: count() })
      .from(userRole)
      .where(eq(userRole.role, "admin"));
    const adminCount = adminCountRow?.value ?? 0;

    const isAdmin = await isAdminUser(ctx.db, ctx.session.user.id);
    const honorSystemEnabled = await getHonorSystemEnabled(ctx.db);
    return {
      isAdmin,
      hasAnyAdmin: adminCount > 0,
      honorSystemEnabled,
      canSelfPromote: !isAdmin && honorSystemEnabled,
    };
  }),

  bootstrapFirstAdmin: protectedProcedure.mutation(async ({ ctx }) => {
    const [adminCountRow] = await ctx.db
      .select({ value: count() })
      .from(userRole)
      .where(eq(userRole.role, "admin"));
    const adminCount = adminCountRow?.value ?? 0;
    if (adminCount > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Admin role already bootstrapped",
      });
    }

    await ctx.db.insert(userRole).values({
      userId: ctx.session.user.id,
      role: "admin",
      createdByUserId: ctx.session.user.id,
    });
    await logAdminAction({
      db: ctx.db,
      actorUserId: ctx.session.user.id,
      action: "bootstrap_first_admin",
      targetType: "user_role",
      targetId: ctx.session.user.id,
      payload: { role: "admin" },
    });
    return { ok: true };
  }),

  becomeAdmin: protectedProcedure.mutation(async ({ ctx }) => {
    const isAdmin = await isAdminUser(ctx.db, ctx.session.user.id);
    if (isAdmin) return { ok: true };

    const honorSystemEnabled = await getHonorSystemEnabled(ctx.db);
    if (!honorSystemEnabled) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Admin honor system is disabled",
      });
    }

    await ctx.db.insert(userRole).values({
      userId: ctx.session.user.id,
      role: "admin",
      createdByUserId: ctx.session.user.id,
    });
    await logAdminAction({
      db: ctx.db,
      actorUserId: ctx.session.user.id,
      action: "self_promote_admin",
      targetType: "user_role",
      targetId: ctx.session.user.id,
      payload: {},
    });
    return { ok: true };
  }),

  setHonorSystemEnabled: protectedProcedure
    .input(z.object({ enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      await ctx.db
        .insert(appSetting)
        .values({
          key: ADMIN_HONOR_SYSTEM_KEY,
          value: input.enabled ? "true" : "false",
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: appSetting.key,
          set: {
            value: input.enabled ? "true" : "false",
            updatedAt: new Date(),
          },
        });
      await logAdminAction({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        action: "set_admin_honor_system",
        targetType: "app_setting",
        targetId: ADMIN_HONOR_SYSTEM_KEY,
        payload: { enabled: input.enabled },
      });
      return { ok: true };
    }),

  listUsersForAdmin: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const users = await ctx.db.query.user.findMany({
      columns: {
        id: true,
        name: true,
        email: true,
        isNonUser: true,
      },
      with: {
        roles: {
          columns: { role: true },
          where: (r, { eq }) => eq(r.role, "admin"),
        },
      },
      orderBy: (u, { asc }) => [asc(u.name), asc(u.email)],
    });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      isNonUser: u.isNonUser,
      isAdmin: u.roles.length > 0,
    }));
  }),

  setUserAdmin: protectedProcedure
    .input(z.object({ userId: z.string().min(1), isAdmin: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const existingUser = await ctx.db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, input.userId),
        columns: { id: true },
      });
      if (!existingUser) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      const hasRole = await ctx.db.query.userRole.findFirst({
        where: (r, { and, eq }) =>
          and(eq(r.userId, input.userId), eq(r.role, "admin")),
      });

      if (input.isAdmin && !hasRole) {
        await ctx.db.insert(userRole).values({
          userId: input.userId,
          role: "admin",
          createdByUserId: ctx.session.user.id,
        });
      } else if (!input.isAdmin && hasRole) {
        const [adminCountRow] = await ctx.db
          .select({ value: count() })
          .from(userRole)
          .where(eq(userRole.role, "admin"));
        const adminCount = adminCountRow?.value ?? 0;
        const honorSystemEnabled = await getHonorSystemEnabled(ctx.db);
        if (adminCount <= 1 && !honorSystemEnabled) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Cannot remove the last admin while honor system is disabled",
          });
        }

        await ctx.db
          .delete(userRole)
          .where(
            and(eq(userRole.userId, input.userId), eq(userRole.role, "admin")),
          );
      }

      await logAdminAction({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        action: "set_user_admin",
        targetType: "user_role",
        targetId: input.userId,
        payload: { isAdmin: input.isAdmin },
      });
      return { ok: true };
    }),

  listFeedbackLinkCandidates: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const unresolved = await ctx.db.query.feedbackItem.findMany({
      where: (fi, { and, eq, isNull }) =>
        and(
          eq(fi.type, "free_text"),
          isNull(fi.topicLinkId),
          isNull(fi.referencedUserId),
        ),
      columns: {
        id: true,
        topicId: true,
        freeTextValue: true,
        createdAt: true,
      },
      with: {
        topic: { columns: { id: true, name: true } },
      },
      orderBy: (fi, { desc }) => [desc(fi.createdAt)],
      limit: 200,
    });

    const topicIds = [...new Set(unresolved.map((r) => r.topicId))];
    const topicLinks = topicIds.length
      ? await ctx.db.query.topicLink.findMany({
          where: (tl, { inArray }) => inArray(tl.topicId, topicIds),
          columns: { id: true, topicId: true, title: true, url: true },
        })
      : [];

    const users = await ctx.db.query.user.findMany({
      columns: { id: true, name: true, email: true, isNonUser: true },
    });

    return unresolved.map((item) => {
      const text = item.freeTextValue?.trim() ?? "";
      const normalized = normalizeUrl(text);
      const email = text.toLowerCase();
      const perTopicLinks = topicLinks.filter(
        (tl) => tl.topicId === item.topicId,
      );

      const exactLink = normalized
        ? perTopicLinks.find(
            (tl) => tl.url && normalizeUrl(tl.url) === normalized,
          )
        : undefined;

      const exactUserByEmail = users.find(
        (u) => u.email.toLowerCase() === email,
      );
      const exactNameMatches = users.filter(
        (u) => u.name?.trim().toLowerCase() === text.toLowerCase(),
      );
      const exactUser =
        exactUserByEmail ??
        (exactNameMatches.length === 1 ? exactNameMatches[0] : undefined);

      const fuzzyLinks = perTopicLinks
        .map((tl) => ({
          id: tl.id,
          title: tl.title,
          url: tl.url,
          score: Math.max(
            similarityScore(tl.title, text),
            similarityScore(tl.url ?? "", text),
          ),
        }))
        .filter((candidate) => candidate.score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      const fuzzyUsers = users
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          isNonUser: u.isNonUser,
          score: Math.max(
            similarityScore(u.name ?? "", text),
            similarityScore(u.email, text),
          ),
        }))
        .filter((candidate) => candidate.score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, 5);

      return {
        id: item.id,
        freeTextValue: item.freeTextValue,
        createdAt: item.createdAt,
        topic: item.topic,
        exactTopicLink: exactLink
          ? {
              id: exactLink.id,
              title: exactLink.title,
              url: exactLink.url,
            }
          : null,
        exactUser: exactUser
          ? {
              id: exactUser.id,
              name: exactUser.name,
              email: exactUser.email,
              isNonUser: exactUser.isNonUser,
            }
          : null,
        fuzzyTopicLinks: fuzzyLinks,
        fuzzyUsers,
      };
    });
  }),

  applyFeedbackLinkSuggestion: protectedProcedure
    .input(
      z.object({
        feedbackItemId: z.number(),
        topicLinkId: z.number().nullable().optional(),
        referencedUserId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const item = await ctx.db.query.feedbackItem.findFirst({
        where: (fi, { eq }) => eq(fi.id, input.feedbackItemId),
        columns: { id: true, type: true, topicId: true },
      });
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feedback item not found",
        });
      }

      let type = item.type;
      if (input.topicLinkId) type = "resource";
      else if (input.referencedUserId) type = "user";

      await ctx.db
        .update(feedbackItem)
        .set({
          topicLinkId: input.topicLinkId ?? null,
          referencedUserId: input.referencedUserId ?? null,
          type,
        })
        .where(eq(feedbackItem.id, input.feedbackItemId));

      await logAdminAction({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        action: "apply_feedback_link_suggestion",
        targetType: "feedback_item",
        targetId: String(input.feedbackItemId),
        payload: {
          topicLinkId: input.topicLinkId ?? null,
          referencedUserId: input.referencedUserId ?? null,
        },
      });
      return { ok: true };
    }),

  manualLinkFeedbackTopicLink: protectedProcedure
    .input(
      z.object({
        feedbackItemId: z.number(),
        title: z.string().trim().min(1).max(512),
        url: z.string().trim().max(2048).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const item = await ctx.db.query.feedbackItem.findFirst({
        where: (fi, { eq }) => eq(fi.id, input.feedbackItemId),
        columns: { id: true, topicId: true },
      });
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feedback item not found",
        });
      }

      const rawUrl = input.url?.trim() ?? "";
      const allTopicLinks = await ctx.db.query.topicLink.findMany({
        where: (tl, { eq }) => eq(tl.topicId, item.topicId),
        columns: { id: true, title: true, url: true, position: true },
      });

      let resolvedTopicLinkId: number | null = null;
      if (rawUrl) {
        const normalizedInputUrl = normalizeUrl(rawUrl);
        if (!normalizedInputUrl) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid URL format",
          });
        }
        const existingByUrl = allTopicLinks.find(
          (tl) => tl.url && normalizeUrl(tl.url) === normalizedInputUrl,
        );
        if (existingByUrl) {
          resolvedTopicLinkId = existingByUrl.id;
        } else {
          const nextPosition = allTopicLinks.reduce(
            (maxPos, link) => Math.max(maxPos, link.position),
            -1,
          );
          const [created] = await ctx.db
            .insert(topicLink)
            .values({
              topicId: item.topicId,
              title: input.title,
              url: rawUrl,
              position: nextPosition + 1,
            })
            .returning({ id: topicLink.id });
          resolvedTopicLinkId = created?.id ?? null;
        }
      } else {
        const existingByTitle = allTopicLinks.find(
          (tl) =>
            tl.title.trim().toLowerCase() === input.title.trim().toLowerCase(),
        );
        if (existingByTitle) {
          resolvedTopicLinkId = existingByTitle.id;
        } else {
          const nextPosition = allTopicLinks.reduce(
            (maxPos, link) => Math.max(maxPos, link.position),
            -1,
          );
          const [created] = await ctx.db
            .insert(topicLink)
            .values({
              topicId: item.topicId,
              title: input.title,
              url: null,
              position: nextPosition + 1,
            })
            .returning({ id: topicLink.id });
          resolvedTopicLinkId = created?.id ?? null;
        }
      }

      if (!resolvedTopicLinkId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to resolve topic link",
        });
      }

      await ctx.db
        .update(feedbackItem)
        .set({
          type: "resource",
          topicLinkId: resolvedTopicLinkId,
          referencedUserId: null,
        })
        .where(eq(feedbackItem.id, input.feedbackItemId));

      await logAdminAction({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        action: "manual_link_feedback_topic_link",
        targetType: "feedback_item",
        targetId: String(input.feedbackItemId),
        payload: {
          topicLinkId: resolvedTopicLinkId,
          title: input.title,
          hasUrl: !!rawUrl,
        },
      });

      return { ok: true, topicLinkId: resolvedTopicLinkId };
    }),

  manualLinkFeedbackTeacher: protectedProcedure
    .input(
      z.object({
        feedbackItemId: z.number(),
        name: z.string().trim().min(1).max(255),
        email: z.string().trim().email().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const item = await ctx.db.query.feedbackItem.findFirst({
        where: (fi, { eq }) => eq(fi.id, input.feedbackItemId),
        columns: { id: true, topicId: true },
      });
      if (!item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Feedback item not found",
        });
      }

      const normalizedEmail = input.email ? normalizeEmail(input.email) : null;
      let resolvedTeacherId: string | null = null;
      let createdNonUser = false;

      if (normalizedEmail) {
        const existingByEmail = await ctx.db.query.user.findFirst({
          where: (u, { eq }) => eq(u.email, normalizedEmail),
          columns: { id: true },
        });
        if (existingByEmail) {
          resolvedTeacherId = existingByEmail.id;
        }
      }

      if (!resolvedTeacherId) {
        const allUsers = await ctx.db.query.user.findMany({
          columns: { id: true, name: true },
        });
        const normalizedName = input.name.trim().toLowerCase();
        const exactNameMatches = allUsers.filter(
          (u) => u.name?.trim().toLowerCase() === normalizedName,
        );
        if (exactNameMatches.length === 1) {
          resolvedTeacherId = exactNameMatches[0]!.id;
        } else if (exactNameMatches.length > 1 && !normalizedEmail) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "Multiple teachers/users match this name. Provide an email to disambiguate.",
          });
        }
      }

      if (!resolvedTeacherId) {
        if (!normalizedEmail) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Email is required to create a new non-user teacher",
          });
        }

        const [createdUser] = await ctx.db
          .insert(user)
          .values({
            name: input.name.trim(),
            email: normalizedEmail,
            isNonUser: true,
            emailVerified: false,
          })
          .returning({ id: user.id });
        resolvedTeacherId = createdUser?.id ?? null;
        createdNonUser = true;

        if (!resolvedTeacherId) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create non-user teacher",
          });
        }

        await ctx.db.insert(userTopicStatus).values({
          userId: resolvedTeacherId,
          topicId: item.topicId,
          level: "can_teach",
        });
      }

      await ctx.db
        .update(feedbackItem)
        .set({
          type: "user",
          referencedUserId: resolvedTeacherId,
          topicLinkId: null,
        })
        .where(eq(feedbackItem.id, input.feedbackItemId));

      await logAdminAction({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        action: "manual_link_feedback_teacher",
        targetType: "feedback_item",
        targetId: String(input.feedbackItemId),
        payload: {
          referencedUserId: resolvedTeacherId,
          createdNonUser,
          hasEmail: !!normalizedEmail,
        },
      });

      return { ok: true, referencedUserId: resolvedTeacherId, createdNonUser };
    }),

  listNonUserTeachers: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const rows = await ctx.db.query.user.findMany({
      where: (u, { eq }) => eq(u.isNonUser, true),
      columns: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
      with: {
        userTopicStatus: {
          columns: {
            topicId: true,
            level: true,
          },
          with: {
            topic: {
              columns: { id: true, name: true },
            },
          },
          orderBy: (s, { asc }) => [asc(s.topicId)],
        },
      },
      orderBy: (u, { asc }) => [asc(u.name), asc(u.email)],
    });
    return rows.map((row) => ({
      ...row,
      topics: row.userTopicStatus.map((s) => ({
        topicId: s.topicId,
        topicName: s.topic.name,
        level: s.level,
      })),
    }));
  }),

  adminFeedbackTopicStats: protectedProcedure.query(async ({ ctx }) => {
    await assertAdmin(ctx);
    const topics = await ctx.db.query.topic.findMany({
      columns: { id: true, name: true },
      orderBy: (t, { asc }) => [asc(t.id)],
    });
    const statusRows = await ctx.db.query.userTopicStatus.findMany({
      columns: { topicId: true, level: true },
    });
    const transitions = await ctx.db.query.levelTransition.findMany({
      columns: { topicId: true, fromLevel: true, toLevel: true },
    });

    const userCountByTopicLevel = new Map<string, number>();
    for (const row of statusRows) {
      if (row.level) {
        const key = `${row.topicId}:${row.level}`;
        userCountByTopicLevel.set(
          key,
          (userCountByTopicLevel.get(key) ?? 0) + 1,
        );
      }
    }
    const transitionsInByTopicLevel = new Map<string, number>();
    const transitionsOutByTopicLevel = new Map<string, number>();
    for (const row of transitions) {
      if (row.toLevel) {
        const key = `${row.topicId}:${row.toLevel}`;
        transitionsInByTopicLevel.set(
          key,
          (transitionsInByTopicLevel.get(key) ?? 0) + 1,
        );
      }
      if (row.fromLevel) {
        const key = `${row.topicId}:${row.fromLevel}`;
        transitionsOutByTopicLevel.set(
          key,
          (transitionsOutByTopicLevel.get(key) ?? 0) + 1,
        );
      }
    }

    return topics.map((t) => {
      const levels = {} as Record<
        UnderstandingLevel,
        { userCount: number; transitionsIn: number; transitionsOut: number }
      >;
      let hasActivity = false;
      for (const level of UNDERSTANDING_LEVELS) {
        const userCount = userCountByTopicLevel.get(`${t.id}:${level}`) ?? 0;
        const transitionsIn =
          transitionsInByTopicLevel.get(`${t.id}:${level}`) ?? 0;
        const transitionsOut =
          transitionsOutByTopicLevel.get(`${t.id}:${level}`) ?? 0;
        levels[level] = { userCount, transitionsIn, transitionsOut };
        if (userCount > 0 || transitionsIn > 0 || transitionsOut > 0) {
          hasActivity = true;
        }
      }
      return {
        id: t.id,
        name: t.name,
        levels,
        hasActivity,
      };
    });
  }),

  adminFeedbackByTopic: protectedProcedure
    .input(z.object({ topicId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const transitions = await ctx.db.query.levelTransition.findMany({
        where: (t, { eq }) => eq(t.topicId, input.topicId),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        with: {
          user: { columns: { id: true, name: true, email: true } },
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
      const adHocItems = await ctx.db.query.feedbackItem.findMany({
        where: (fi, { and, eq, isNull }) =>
          and(eq(fi.topicId, input.topicId), isNull(fi.transitionId)),
        orderBy: (fi, { desc }) => [desc(fi.createdAt)],
        with: {
          author: { columns: { id: true, name: true, email: true } },
          topicLink: true,
          referencedUser: {
            columns: { id: true, name: true, email: true },
          },
        },
      });
      return { transitions, adHocItems };
    }),

  createNonUserTeacher: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1),
        email: z.string().email(),
        topicIds: z.array(z.number().int().positive()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const email = normalizeEmail(input.email);
      const existing = await ctx.db.query.user.findFirst({
        where: (u, { eq }) => eq(u.email, email),
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists",
        });
      }

      const [created] = await ctx.db
        .insert(user)
        .values({
          name: input.name,
          email,
          isNonUser: true,
          emailVerified: false,
        })
        .returning({ id: user.id });
      const newUserId = created!.id;

      const uniqueTopicIds = [...new Set(input.topicIds)];
      if (uniqueTopicIds.length > 0) {
        await ctx.db.insert(userTopicStatus).values(
          uniqueTopicIds.map((topicId) => ({
            userId: newUserId,
            topicId,
            level: "can_teach" as const,
          })),
        );
      }

      await logAdminAction({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        action: "create_non_user_teacher",
        targetType: "user",
        targetId: newUserId,
        payload: { email, topicIds: uniqueTopicIds },
      });

      return { id: newUserId };
    }),

  updateNonUserTeacher: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        name: z.string().trim().min(1),
        email: z.string().email(),
        topicIds: z.array(z.number().int().positive()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const existing = await ctx.db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, input.userId),
      });
      if (existing?.isNonUser !== true) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Non-user teacher not found",
        });
      }

      const email = normalizeEmail(input.email);
      const conflict = await ctx.db.query.user.findFirst({
        where: (u, { and, eq }) =>
          and(eq(u.email, email), ne(u.id, input.userId)),
      });
      if (conflict) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A user with this email already exists",
        });
      }

      await ctx.db
        .update(user)
        .set({ name: input.name, email })
        .where(eq(user.id, input.userId));

      const desired = new Set(input.topicIds);
      const currentRows = await ctx.db.query.userTopicStatus.findMany({
        where: (s, { eq }) => eq(s.userId, input.userId),
      });
      const current = new Set(currentRows.map((r) => r.topicId));
      const toAdd = [...desired].filter((id) => !current.has(id));
      const toRemove = [...current].filter((id) => !desired.has(id));

      if (toAdd.length > 0) {
        await ctx.db.insert(userTopicStatus).values(
          toAdd.map((topicId) => ({
            userId: input.userId,
            topicId,
            level: "can_teach" as const,
          })),
        );
      }

      if (toRemove.length > 0) {
        await ctx.db
          .delete(userTopicStatus)
          .where(
            and(
              eq(userTopicStatus.userId, input.userId),
              inArray(userTopicStatus.topicId, toRemove),
            ),
          );
      }

      await logAdminAction({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        action: "update_non_user_teacher",
        targetType: "user",
        targetId: input.userId,
        payload: { email, topicIds: [...desired] },
      });
      return { ok: true };
    }),

  deleteNonUserTeacher: protectedProcedure
    .input(
      z.object({
        userId: z.string().min(1),
        deleteTeachingStatusHistory: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertAdmin(ctx);
      const existing = await ctx.db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, input.userId),
      });
      if (existing?.isNonUser !== true) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Non-user teacher not found",
        });
      }

      // Always remove active teacher assignments so they disappear from suggestions.
      await ctx.db
        .delete(userTopicStatus)
        .where(eq(userTopicStatus.userId, input.userId));

      if (input.deleteTeachingStatusHistory) {
        await ctx.db.delete(user).where(eq(user.id, input.userId));
      } else {
        const archivedEmail = `archived+${input.userId}@local.invalid`;
        await ctx.db
          .update(user)
          .set({
            isNonUser: false,
            email: archivedEmail,
          })
          .where(eq(user.id, input.userId));
      }

      await logAdminAction({
        db: ctx.db,
        actorUserId: ctx.session.user.id,
        action: "delete_non_user_teacher",
        targetType: "user",
        targetId: input.userId,
        payload: {
          deleteTeachingStatusHistory: input.deleteTeachingStatusHistory,
        },
      });
      return { ok: true };
    }),

  claimNonUserTeacherAccount: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const existing = await ctx.db.query.user.findFirst({
        where: (u, { and, eq }) =>
          and(eq(u.email, email), eq(u.isNonUser, true)),
      });
      if (!existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No claimable non-user teacher found for this email",
        });
      }

      const archivedEmail = `claimed+${existing.id}@local.invalid`;
      await ctx.db
        .update(user)
        .set({
          email: archivedEmail,
          isNonUser: false,
        })
        .where(eq(user.id, existing.id));

      let createdUserId: string | null = null;
      try {
        const signUpResult = await auth.api.signUpEmail({
          body: {
            email,
            password: input.password,
            name: input.name,
          },
          headers: new Headers(),
        });
        createdUserId = signUpResult.user.id;
      } catch (error) {
        await ctx.db
          .update(user)
          .set({
            email,
            isNonUser: true,
          })
          .where(eq(user.id, existing.id));
        throw error;
      }
      if (!createdUserId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create account for claimed teacher",
        });
      }

      await ctx.db
        .update(userTopicStatus)
        .set({ userId: createdUserId })
        .where(eq(userTopicStatus.userId, existing.id));
      await ctx.db
        .update(levelTransition)
        .set({ userId: createdUserId })
        .where(eq(levelTransition.userId, existing.id));
      await ctx.db
        .update(feedbackItem)
        .set({ userId: createdUserId })
        .where(eq(feedbackItem.userId, existing.id));
      await ctx.db
        .update(feedbackItem)
        .set({ referencedUserId: createdUserId })
        .where(eq(feedbackItem.referencedUserId, existing.id));
      await ctx.db
        .update(bookmark)
        .set({ userId: createdUserId })
        .where(eq(bookmark.userId, existing.id));
      await ctx.db
        .update(resource)
        .set({ submittedById: createdUserId })
        .where(eq(resource.submittedById, existing.id));
      await ctx.db
        .update(teachingSession)
        .set({ teacherId: createdUserId })
        .where(eq(teachingSession.teacherId, existing.id));
      await ctx.db
        .update(teachingSession)
        .set({ learnerId: createdUserId })
        .where(eq(teachingSession.learnerId, existing.id));

      await ctx.db.delete(user).where(eq(user.id, existing.id));
      return { ok: true };
    }),
});
