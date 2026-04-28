import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

import { env } from "~/env";
import { getAllowNewUsersWithoutApproval } from "~/server/approvalPolicy";
import { db } from "~/server/db";
import { user } from "~/server/db/schema";

// Vercel may serve the same deployment under several hostnames (the
// per-deploy VERCEL_URL, the per-branch VERCEL_BRANCH_URL, and the
// production alias). Trust whichever the browser actually used.
const vercelOrigins = [
  process.env.VERCEL_URL,
  process.env.VERCEL_BRANCH_URL,
  process.env.VERCEL_PROJECT_PRODUCTION_URL,
]
  .filter((v): v is string => Boolean(v))
  .map((host) => `https://${host}`);
const baseURL = env.BETTER_AUTH_URL ?? vercelOrigins[0];

export const auth = betterAuth({
  baseURL,
  trustedOrigins: vercelOrigins,
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  databaseHooks: {
    user: {
      // Fires only on a fresh user row (not on account-linking). Applies the
      // approval gate to all new sign-ups regardless of provider.
      create: {
        after: async (createdUser) => {
          const allowNewUsersWithoutApproval =
            await getAllowNewUsersWithoutApproval(db);
          if (allowNewUsersWithoutApproval) return;
          await db
            .update(user)
            .set({ isApproved: false })
            .where(eq(user.id, createdUser.id));
        },
      },
    },
    account: {
      // Fires when a new account row is inserted. For OAuth this includes
      // both fresh sign-ups and linking to an existing user (e.g. a teacher
      // placeholder row created with `isNonUser: true`). When linking to a
      // placeholder, promote it to a real user.
      create: {
        after: async (createdAccount) => {
          await db
            .update(user)
            .set({ isNonUser: false })
            .where(eq(user.id, createdAccount.userId));
        },
      },
    },
  },
  socialProviders:
    env.BETTER_AUTH_DISCORD_CLIENT_ID && env.BETTER_AUTH_DISCORD_CLIENT_SECRET
      ? {
          discord: {
            clientId: env.BETTER_AUTH_DISCORD_CLIENT_ID,
            clientSecret: env.BETTER_AUTH_DISCORD_CLIENT_SECRET,
          },
        }
      : undefined,
  // De-duplicate by email: when a Discord sign-in arrives with an
  // OAuth-verified email matching an existing user, attach instead of
  // erroring. Discord is intentionally NOT in `trustedProviders` — that flag
  // would skip the verified-email check and allow takeover via an unverified
  // Discord email.
  account: {
    accountLinking: { enabled: true },
  },
});

export type Session = typeof auth.$Infer.Session;
