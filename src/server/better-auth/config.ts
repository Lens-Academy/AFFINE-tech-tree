import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";

import { env } from "~/env";
import { getAllowNewUsersWithoutApproval } from "~/server/approvalPolicy";
import { db } from "~/server/db";
import { user } from "~/server/db/schema";

/** Ephemeral store for password-reset URLs so the admin tRPC procedure can
 *  retrieve the link that Better Auth generates inside sendResetPassword. */
export const pendingResetUrls = new Map<string, string>();

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
    // Fires on every new user row, regardless of provider (email/password,
    // Discord, etc.). Account-linking does NOT create a new user, so existing
    // users keep their approval status when they later attach Discord.
    user: {
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
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // TODO: env.NODE_ENV === "production",
    sendResetPassword: async ({ user, url }) => {
      pendingResetUrls.set(user.email.toLowerCase(), url);
      if (env.NODE_ENV !== "production") {
        console.log(`[dev] Password reset for ${user.email}: ${url}`);
      }
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      if (env.NODE_ENV !== "production") {
        console.log(`[dev] Verification email for ${user.email}: ${url}`);
        return;
      }
      // TODO: Wire up Resend, Nodemailer, or similar
      console.warn(`Email verification not configured. URL: ${url}`);
    },
    sendOnSignUp: true,
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
  // OAuth-verified email matching an existing user, attach it instead of
  // erroring. Discord is intentionally NOT in `trustedProviders` — that flag
  // would skip the verified-email check and allow takeover via an unverified
  // Discord email.
  account: {
    accountLinking: { enabled: true },
  },
});

export type Session = typeof auth.$Infer.Session;
