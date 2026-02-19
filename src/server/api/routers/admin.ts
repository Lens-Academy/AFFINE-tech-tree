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
import {
  adminActionLog,
  appSetting,
  user,
  userRole,
  userTopicStatus,
  levelTransition,
  bookmark,
  feedbackItem,
  resource,
  teachingSession,
} from "~/server/db/schema";

const ADMIN_HONOR_SYSTEM_KEY = "admin_honor_system_enabled";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
