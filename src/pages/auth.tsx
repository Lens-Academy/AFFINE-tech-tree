import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import { useAppMutation } from "~/hooks/useAppMutation";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/utils/api";

type ClaimNonUserMutationOptions = Exclude<
  Parameters<typeof api.admin.claimNonUserTeacherAccount.useMutation>[0],
  undefined
>;

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/30 focus:outline-none";

export default function AuthPage() {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signUpError, setSignUpError] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [signUpLoading, setSignUpLoading] = useState(false);
  const [signInLoading, setSignInLoading] = useState(false);
  const claimNonUserTeacher = useAppMutation(
    (opts: ClaimNonUserMutationOptions) =>
      api.admin.claimNonUserTeacherAccount.useMutation(opts),
  );

  useEffect(() => {
    if (session?.user) {
      void router.replace("/");
    }
  }, [router, session?.user]);

  if (session?.user) return null;

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setSignUpError(null);
    setSignUpLoading(true);
    try {
      const { error } = await authClient.signUp.email({
        email,
        password,
        name,
      });
      if (error) {
        const lower = (error.message ?? "").toLowerCase();
        const mayBeExistingEmail =
          lower.includes("already exists") ||
          lower.includes("use another email");
        if (!mayBeExistingEmail) {
          setSignUpError(error.message ?? "Sign-up failed");
          return;
        }
        try {
          await claimNonUserTeacher.mutateAsync({
            email,
            password,
            name,
          });
          const signIn = await authClient.signIn.email({ email, password });
          if (signIn.error) {
            setSignUpError(
              signIn.error.message ?? "Sign-in failed after claiming account",
            );
            return;
          }
        } catch (claimError) {
          const claimMsg =
            claimError instanceof Error ? claimError.message : null;
          setSignUpError(
            claimMsg?.toLowerCase().includes("no claimable")
              ? "This email is already registered. Please sign in instead."
              : (claimMsg ?? error.message ?? "Sign-up failed"),
          );
          return;
        }
      }
      void router.push("/");
    } catch {
      setSignUpError("Something went wrong. Please try again.");
    } finally {
      setSignUpLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSignInError(null);
    setSignInLoading(true);
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setSignInError(error.message ?? "Sign-in failed");
        return;
      }
      void router.push("/");
    } catch {
      setSignInError("Something went wrong. Please try again.");
    } finally {
      setSignInLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Sign in | AFFINE Tech Tree</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-2xl">
          <Link
            href="/"
            className="mb-8 inline-block text-sm text-zinc-500 hover:text-zinc-300"
          >
            ← Back to topics
          </Link>
          <div className="flex flex-col gap-8 sm:flex-row sm:gap-12">
            {/* Sign up - left */}
            <div className="flex flex-1 flex-col">
              <h2 className="mb-4 text-xl font-bold text-zinc-100">
                Create an account
              </h2>
              <form
                onSubmit={(e) => void handleSignUp(e)}
                className="flex flex-1 flex-col"
              >
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-sm text-zinc-400">
                      Name
                    </span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
                <div className="mt-auto space-y-4 pt-4">
                  <label className="block">
                    <span className="mb-1 block text-sm text-zinc-400">
                      Email
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm text-zinc-400">
                      Password
                    </span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  {signUpError && (
                    <p className="text-sm text-red-400">{signUpError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={signUpLoading}
                    className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-orange-400 disabled:opacity-50"
                  >
                    {signUpLoading ? "Please wait..." : "Sign up"}
                  </button>
                </div>
              </form>
            </div>

            <div className="hidden sm:block sm:w-px sm:self-stretch sm:bg-zinc-800" />
            <div className="border-t border-zinc-800 pt-8 sm:hidden" />

            {/* Sign in - right */}
            <div className="flex flex-1 flex-col">
              <h2 className="mb-4 text-xl font-bold text-zinc-100">Sign in</h2>
              <form
                onSubmit={(e) => void handleSignIn(e)}
                className="flex flex-1 flex-col"
              >
                <div className="mt-auto space-y-4">
                  <label className="block">
                    <span className="mb-1 block text-sm text-zinc-400">
                      Email
                    </span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-sm text-zinc-400">
                      Password
                    </span>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  {signInError && (
                    <p className="text-sm text-red-400">{signInError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={signInLoading}
                    className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-orange-400 disabled:opacity-50"
                  >
                    {signInLoading ? "Please wait..." : "Sign in"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
