import Link from "next/link";

import { authClient } from "~/server/better-auth/client";
import { NotificationBell } from "~/components/NotificationBell";
import { api } from "~/utils/api";

export function AuthHeader() {
  const { data: session, isPending } = authClient.useSession();
  const utils = api.useUtils();
  const adminStatus = api.admin.getAdminStatus.useQuery(undefined, {
    enabled: !!session?.user,
  });

  if (isPending) {
    return <span className="text-sm text-zinc-500">Loading…</span>;
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href={`/user/${session.user.id}`}
          className="rounded px-2 py-1 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          {session.user.name ?? session.user.email}
        </Link>
        {adminStatus.data?.isAdmin && (
          <Link
            href="/admin"
            className="rounded px-2 py-1 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            Admin
          </Link>
        )}
        <NotificationBell />
        <button
          type="button"
          onClick={() => {
            void utils.userStatus.getAll.reset();
            void authClient.signOut();
          }}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:border-orange-500/50 hover:bg-zinc-700"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/auth"
      className="rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400 transition hover:bg-orange-500/20"
    >
      Sign in
    </Link>
  );
}
