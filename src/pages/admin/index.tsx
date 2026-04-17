import Head from "next/head";
import Link from "next/link";
import { PageLayout } from "~/components/PageLayout";
import { getSegmentLabel } from "~/shared/userSegments";
import { useAppMutation } from "~/hooks/useAppMutation";
import { useViewerAccess } from "~/hooks/useViewerAccess";
import { api, type RouterInputs, type RouterOutputs } from "~/utils/api";

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
type SetAllowNewUsersWithoutApprovalMutationOptions = Exclude<
  Parameters<typeof api.admin.setAllowNewUsersWithoutApproval.useMutation>[0],
  undefined
>;
type SetUserApprovalMutationOptions = Exclude<
  Parameters<typeof api.admin.setUserApproval.useMutation>[0],
  undefined
>;
export default function AdminHomePage() {
  const { rawUser, isPending } = useViewerAccess();
  const utils = api.useUtils();
  const status = api.admin.getAdminStatus.useQuery(undefined, {
    enabled: !!rawUser,
  });
  const users = api.admin.listUsersForAdmin.useQuery(undefined, {
    enabled: !!rawUser && !!status.data?.isAdmin,
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
      onMutate: async (rawVars) => {
        const vars = rawVars as RouterInputs["admin"]["setHonorSystemEnabled"];
        await utils.admin.getAdminStatus.cancel();
        const previous = utils.admin.getAdminStatus.getData();
        utils.admin.getAdminStatus.setData(undefined, (old) =>
          old ? { ...old, honorSystemEnabled: vars.enabled } : old,
        );
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        const context = ctx as
          | { previous?: RouterOutputs["admin"]["getAdminStatus"] }
          | undefined;
        if (context?.previous) {
          utils.admin.getAdminStatus.setData(undefined, context.previous);
        }
      },
      refresh: [() => utils.admin.getAdminStatus.invalidate()],
    },
  );
  const setAllowNewUsersWithoutApproval = useAppMutation(
    (opts: SetAllowNewUsersWithoutApprovalMutationOptions) =>
      api.admin.setAllowNewUsersWithoutApproval.useMutation(opts),
    {
      onMutate: async (rawVars) => {
        const vars =
          rawVars as RouterInputs["admin"]["setAllowNewUsersWithoutApproval"];
        await utils.admin.getAdminStatus.cancel();
        const previous = utils.admin.getAdminStatus.getData();
        utils.admin.getAdminStatus.setData(undefined, (old) =>
          old ? { ...old, allowNewUsersWithoutApproval: vars.enabled } : old,
        );
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        const context = ctx as
          | { previous?: RouterOutputs["admin"]["getAdminStatus"] }
          | undefined;
        if (context?.previous) {
          utils.admin.getAdminStatus.setData(undefined, context.previous);
        }
      },
      refresh: [() => utils.admin.getAdminStatus.invalidate()],
    },
  );
  const setUserApproval = useAppMutation(
    (opts: SetUserApprovalMutationOptions) =>
      api.admin.setUserApproval.useMutation(opts),
    {
      onMutate: async (rawVars) => {
        const vars = rawVars as RouterInputs["admin"]["setUserApproval"];
        await utils.admin.listUsersForAdmin.cancel();
        const previous = utils.admin.listUsersForAdmin.getData();
        utils.admin.listUsersForAdmin.setData(undefined, (old) =>
          (old ?? []).map((u) =>
            u.id === vars.userId ? { ...u, isApproved: vars.isApproved } : u,
          ),
        );
        return { previous };
      },
      onError: (_err, _vars, ctx) => {
        const context = ctx as
          | { previous?: RouterOutputs["admin"]["listUsersForAdmin"] }
          | undefined;
        if (context?.previous) {
          utils.admin.listUsersForAdmin.setData(undefined, context.previous);
        }
      },
      refresh: [() => utils.admin.listUsersForAdmin.invalidate()],
    },
  );

  return (
    <>
      <Head>
        <title>Admin | AFFINE Tech Tree</title>
      </Head>
      <PageLayout>
        <div>
          <h1 className="mb-4 text-3xl font-bold text-zinc-100">Admin</h1>
          {isPending && <p className="text-zinc-500">Loading session…</p>}
          {!isPending && !rawUser && (
            <p className="text-zinc-400">
              Please sign in to access admin features.
            </p>
          )}

          {rawUser && status.data && (
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
                      <li>
                        <Link
                          href="/admin/feedback"
                          className="text-orange-400 hover:text-orange-300"
                        >
                          Feedback overview
                        </Link>
                      </li>
                      <li>
                        <Link
                          href="/graph"
                          className="text-orange-400 hover:text-orange-300"
                        >
                          Graph
                        </Link>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
                    <div className="mb-4 flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-zinc-200">
                          Allow new users without approval
                        </h2>
                        <p className="text-sm text-zinc-500">
                          When disabled, new self-created accounts must be
                          approved by an admin before they can use features.
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={status.data.allowNewUsersWithoutApproval}
                          onChange={(e) =>
                            setAllowNewUsersWithoutApproval.mutate({
                              enabled: e.target.checked,
                            })
                          }
                          disabled={setAllowNewUsersWithoutApproval.isPending}
                        />
                        Enabled
                      </label>
                    </div>
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
                    <h2 className="mb-3 text-zinc-200">Users</h2>
                    {users.isLoading ? (
                      <p className="text-sm text-zinc-500">Loading users…</p>
                    ) : (
                      <ul className="space-y-2">
                        {(users.data ?? []).map((u) => (
                          <li key={u.id}>
                            <Link
                              href={`/user/${u.id}`}
                              className="flex items-center justify-between rounded border border-zinc-800 px-3 py-2 transition hover:border-zinc-600 hover:bg-zinc-800/50"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm text-zinc-200">
                                  {u.name ?? "(no name)"}
                                </div>
                                <div className="truncate text-xs text-zinc-500">
                                  {u.email}
                                  {u.isNonUser ? " · non-user" : ""}
                                  {!u.isApproved ? " · waiting approval" : ""}
                                  {" · "}
                                  {getSegmentLabel(u.segment)}
                                </div>
                              </div>
                              <div className="ml-3 flex items-center gap-2">
                                {!u.isApproved && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setUserApproval.mutate({
                                        userId: u.id,
                                        isApproved: true,
                                      });
                                    }}
                                    disabled={setUserApproval.isPending}
                                    className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600 disabled:opacity-50"
                                  >
                                    Approve
                                  </button>
                                )}
                                {u.isAdmin && (
                                  <span className="text-xs text-orange-400">
                                    Admin
                                  </span>
                                )}
                              </div>
                            </Link>
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
      </PageLayout>
    </>
  );
}
