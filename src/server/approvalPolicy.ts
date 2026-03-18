import { and, eq } from "drizzle-orm";

import type { Db } from "~/server/db";
import { appSetting, userRole } from "~/server/db/schema";

export const ALLOW_NEW_USERS_WITHOUT_APPROVAL_KEY =
  "allow_new_users_without_approval";

export async function getAllowNewUsersWithoutApproval(db: Db) {
  const row = await db.query.appSetting.findFirst({
    where: eq(appSetting.key, ALLOW_NEW_USERS_WITHOUT_APPROVAL_KEY),
    columns: { value: true },
  });
  return row?.value !== "false";
}

export async function isUserApproved(db: Db, userId: string) {
  const row = await db.query.user.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { isApproved: true },
  });
  return row?.isApproved ?? false;
}

export async function isAdminUser(db: Db, userId: string) {
  const role = await db.query.userRole.findFirst({
    where: and(eq(userRole.userId, userId), eq(userRole.role, "admin")),
    columns: { id: true },
  });
  return !!role;
}
