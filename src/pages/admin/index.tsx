import Head from "next/head";
import Link from "next/link";
import { useState } from "react";

import { AuthHeader } from "~/components/AuthHeader";
import { useAppMutation } from "~/hooks/useAppMutation";
import { authClient } from "~/server/better-auth/client";
import { api } from "~/utils/api";

type BootstrapMutationOptions = Exclude<
  Parameters<typeof api.admin.bootstrapFirstAdmin.useMutation>[0],
  undefined
>;
type BecomeAdminMutationOptions = Exclude<
  Parameters<typeof api.admin.becomeAdmin.useMutation>[0],
  undefined
>;
type SetHonorSystemMutationOptions = Exclude<
  Parameters<typeof api.admin.setHonorSystemEnabled.useMutation>[0],
  undefined
>;
type SetUserAdminMutationOptions = Exclude<
  Parameters<typeof api.admin.setUserAdmin.useMutation>[0],
  undefined
>;

export default function AdminHomePage() {
  const { data: session, isPending } = authClient.useSession();
  const utils = api.useUtils();
  const status = api.admin.getAdminStatus.useQuery(undefined, {
    enabled: !!session?.user,
  });
  const users = api.admin.listUsersForAdmin.useQuery(undefined, {
    enabled: !!session?.user && !!status.data?.isAdmin,
  });
  const bootstrap = useAppMutation(
    (opts: BootstrapMutationOptions) =>
      api.admin.bootstrapFirstAdmin.useMutation(opts),
    {
      refresh: [() => utils.admin.getAdminStatus.invalidate()],
    },
  );
  const becomeAdmin = useAppMutation(
    (opts: BecomeAdminMutationOptions) =>
      api.admin.becomeAdmin.useMutation(opts),
    {
      refresh: [
        () => utils.admin.getAdminStatus.invalidate(),
        () => utils.admin.listUsersForAdmin.invalidate(),
      ],
    },
  );
  const setHonorSystem = useAppMutation(
    (opts: SetHonorSystemMutationOptions) =>
      api.admin.setHonorSystemEnabled.useMutation(opts),
    {
      refresh: [() => utils.admin.getAdminStatus.invalidate()],
    },
  );
  const setUserAdmin = useAppMutation(
    (opts: SetUserAdminMutationOptions) =>
      api.admin.setUserAdmin.useMutation(opts),
    {
      refresh: [
        () => utils.admin.listUsersForAdmin.invalidate(),
        () => utils.admin.getAdminStatus.invalidate(),
      ],
    },
  );
  const [manageError, setManageError] = useState<string | null>(null);

  return (
    <>
      <Head>
        <title>Admin | AFFINE Tech Tree</title>
      </Head>
      <main className="min-h-screen bg-zinc-950 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-3xl">
          <div className="mb-6 flex items-center justify-between">
            <Link
              href="/"
              className="text-sm text-zinc-500 hover:text-zinc-300"
            >
              ← Back to topics
            </Link>
            <AuthHeader />
          </div>

          <h1 className="mb-4 text-3xl font-bold text-zinc-100">Admin</h1>
          {isPending && <p className="text-zinc-500">Loading session…</p>}
          {!isPending && !session?.user && (
            <p className="text-zinc-400">
              Please sign in to access admin features.
            </p>
          )}

          {session?.user && status.data && (
            <div className="space-y-4">
              {!status.data.hasAnyAdmin && (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                  <p className="mb-3 text-sm text-zinc-300">
                    No admin account exists yet. Bootstrap the first admin.
                  </p>
                  <button
                    type="button"
                    onClick={() => bootstrap.mutate()}
                    disabled={bootstrap.isPending}
                    className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-orange-400 disabled:opacity-50"
                  >
                    {bootstrap.isPending
                      ? "Bootstrapping…"
                      : "Become first admin"}
                  </button>
                </div>
              )}

              {!status.data.isAdmin && status.data.canSelfPromote && (
                <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                  <p className="mb-3 text-sm text-zinc-300">
                    Admin honor system is enabled. You can make yourself an
                    admin.
                  </p>
                  <button
                    type="button"
                    onClick={() => becomeAdmin.mutate()}
                    disabled={becomeAdmin.isPending}
                    className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-orange-400 disabled:opacity-50"
                  >
                    {becomeAdmin.isPending ? "Applying…" : "Become admin"}
                  </button>
                </div>
              )}

              {status.data.isAdmin ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                    <p className="mb-3 text-zinc-300">Admin actions</p>
                    <ul className="space-y-2">
                      <li>
                        <Link
                          href="/admin/non-user-teachers"
                          className="text-orange-400 hover:text-orange-300"
                        >
                          Manage non-user teachers
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/admin/feedback-linking"
                          className="text-orange-400 hover:text-orange-300"
                        >
                          Review feedback link candidates
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-zinc-200">Admin honor system</h2>
                        <p className="text-sm text-zinc-500">
                          When enabled, any signed-in user can become admin from
                          this page.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={status.data.honorSystemEnabled}
                          onChange={(e) =>
                            setHonorSystem.mutate({ enabled: e.target.checked })
                          }
                          disabled={setHonorSystem.isPending}
                        />
                        Enabled
                      </label>
                    </div>
                  </div>

                  <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                    <h2 className="mb-3 text-zinc-200">User admin access</h2>
                    {manageError && (
                      <p className="mb-2 text-sm text-red-400">{manageError}</p>
                    )}
                    {users.isLoading ? (
                      <p className="text-sm text-zinc-500">Loading users…</p>
                    ) : (
                      <ul className="space-y-2">
                        {(users.data ?? []).map((u) => (
                          <li
                            key={u.id}
                            className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm text-zinc-200">
                                {u.name ?? "(no name)"}
                              </div>
                              <div className="truncate text-xs text-zinc-500">
                                {u.email}
                                {u.isNonUser ? " · non-user" : ""}
                              </div>
                            </div>
                            <label className="ml-3 flex items-center gap-2 text-xs text-zinc-300">
                              <input
                                type="checkbox"
                                checked={u.isAdmin}
                                disabled={setUserAdmin.isPending}
                                onChange={async (e) => {
                                  setManageError(null);
                                  try {
                                    await setUserAdmin.mutateAsync({
                                      userId: u.id,
                                      isAdmin: e.target.checked,
                                    });
                                  } catch (err) {
                                    const message =
                                      err instanceof Error
                                        ? err.message
                                        : "Failed to update admin role";
                                    setManageError(message);
                                  }
                                }}
                              />
                              Admin
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                status.data.hasAnyAdmin && (
                  <p className="text-zinc-400">
                    Your account is not an admin. Ask an existing admin to grant
                    access.
                  </p>
                )
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
