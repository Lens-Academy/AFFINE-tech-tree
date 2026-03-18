import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

import { authClient } from "~/server/better-auth/client";

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/30 focus:outline-none";

function getSingleQueryValue(value: string | string[] | undefined) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const token = useMemo(
    () => getSingleQueryValue(router.query.token).trim(),
    [router.query.token],
  );
  const resetError = useMemo(
    () => getSingleQueryValue(router.query.error).trim(),
    [router.query.error],
  );

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("Missing or invalid reset token.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await authClient.resetPassword({
        token,
        newPassword,
      });
      if (result.error) {
        setError(result.error.message ?? "Failed to reset password.");
        return;
      }
      setSuccess("Password reset successful. You can now sign in.");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Failed to reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Reset password | AFFINE Tech Tree</title>
      </Head>
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="mb-2 text-2xl font-semibold text-zinc-100">
            Reset password
          </h1>
          <p className="mb-5 text-sm text-zinc-400">
            Enter a new password for your account.
          </p>

          {resetError && (
            <p className="mb-3 text-sm text-red-400">
              This reset link is invalid or expired ({resetError}).
            </p>
          )}
          {!token && (
            <p className="mb-3 text-sm text-red-400">
              Missing reset token. Request a new reset link.
            </p>
          )}

          <form onSubmit={(e) => void onSubmit(e)} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-zinc-400">
                New password
              </span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-zinc-400">
                Confirm new password
              </span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                required
                className={inputClass}
              />
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-400">{success}</p>}

            <button
              type="submit"
              disabled={submitting || !token}
              className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-orange-400 disabled:opacity-50"
            >
              {submitting ? "Resetting..." : "Reset password"}
            </button>
          </form>

          <div className="mt-4 text-sm">
            <Link href="/auth" className="text-zinc-400 hover:text-zinc-200">
              Back to sign in
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
