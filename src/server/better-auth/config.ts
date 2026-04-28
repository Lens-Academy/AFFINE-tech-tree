import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
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
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-up/email") return;
      const newUserId = ctx.context.newSession?.user.id;
      if (!newUserId) return;
      const allowNewUsersWithoutApproval =
        await getAllowNewUsersWithoutApproval(db);
      if (allowNewUsersWithoutApproval) return;
      await db
        .update(user)
        .set({ isApproved: false })
        .where(eq(user.id, newUserId));
    }),
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
  // socialProviders: {
  //   github: {
  //     clientId: env.BETTER_AUTH_GITHUB_CLIENT_ID,
  //     clientSecret: env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
  //     redirectURI: "http://localhost:3000/api/auth/callback/github",
  //   },
  // },
});

export type Session = typeof auth.$Infer.Session;
