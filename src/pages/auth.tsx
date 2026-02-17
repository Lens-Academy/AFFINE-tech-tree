import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";

import { authClient } from "~/server/better-auth/client";

export default function AuthPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session?.user) {
    void router.replace("/");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "sign-up") {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name: name || email,
        });
        if (error) {
          setError(error.message ?? "Sign-up failed");
          return;
        }
      } else {
        const { error } = await authClient.signIn.email({
          email,
          password,
        });
        if (error) {
          setError(error.message ?? "Sign-in failed");
          return;
        }
      }
      void router.push("/");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>{mode === "sign-in" ? "Sign in" : "Sign up"} | AFFINE Tech Tree</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-8 inline-block text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Back to topics
          </Link>

          <h1 className="mb-6 text-2xl font-bold text-zinc-100">
            {mode === "sign-in" ? "Sign in" : "Create an account"}
          </h1>

          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            {mode === "sign-up" && (
              <label className="block">
                <span className="mb-1 block text-sm text-zinc-400">Name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                  placeholder="Optional"
                />
              </label>
            )}

            <label className="block">
              <span className="mb-1 block text-sm text-zinc-400">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                placeholder="you@example.com"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-zinc-400">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500/50 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              />
            </label>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-orange-400 disabled:opacity-50"
            >
              {loading
                ? "Please wait…"
                : mode === "sign-in"
                  ? "Sign in"
                  : "Sign up"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-zinc-500">
            {mode === "sign-in" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("sign-up");
                    setError(null);
                  }}
                  className="text-orange-400 hover:text-orange-300"
                >
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("sign-in");
                    setError(null);
                  }}
                  className="text-orange-400 hover:text-orange-300"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </main>
    </>
  );
}
