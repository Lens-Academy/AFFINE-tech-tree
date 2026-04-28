import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { env } from "~/env";
import { authClient } from "~/server/better-auth/client";

type AuthPageProps = { discordEnabled: boolean };

export const getServerSideProps: GetServerSideProps<AuthPageProps> = () =>
  Promise.resolve({
    props: {
      discordEnabled: Boolean(
        env.BETTER_AUTH_DISCORD_CLIENT_ID &&
        env.BETTER_AUTH_DISCORD_CLIENT_SECRET,
      ),
    },
  });

export default function AuthPage({ discordEnabled }: AuthPageProps) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session?.user) {
      void router.replace("/");
    }
  }, [router, session?.user]);

  if (session?.user) return null;

  async function handleDiscord() {
    setError(null);
    setLoading(true);
    try {
      const { error: signInError } = await authClient.signIn.social({
        provider: "discord",
        callbackURL: "/",
      });
      if (signInError) {
        setError(signInError.message ?? "Sign-in failed");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign in | AFFINE Tech Tree</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="mb-8 inline-block text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Back to topics
          </Link>
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8">
            <h1 className="mb-2 text-xl font-bold text-zinc-100">Sign in</h1>
            <p className="mb-6 text-sm text-zinc-500">
              Use your Discord account to sign in or create an account.
            </p>
            {discordEnabled ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleDiscord()}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#4752c4] disabled:opacity-50"
                >
                  {loading ? "Redirecting…" : "Continue with Discord"}
                </button>
                {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
              </>
            ) : (
              <p className="text-sm text-red-400">
                Discord login is not configured. Ask an admin to set
                BETTER_AUTH_DISCORD_CLIENT_ID and
                BETTER_AUTH_DISCORD_CLIENT_SECRET.
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
