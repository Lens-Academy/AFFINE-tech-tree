import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { env } from "~/env";
import { db } from "~/server/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "sqlite",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: env.NODE_ENV === "production",
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
