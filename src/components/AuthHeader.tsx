import Link from "next/link";

import { useViewerAccess } from "~/hooks/useViewerAccess";
import { authClient } from "~/server/better-auth/client";
import { NotificationBell } from "~/components/NotificationBell";
import { api } from "~/utils/api";

export function AuthHeader() {
  const { rawUser, viewerUser, isPending, isPendingApproval, isAdmin } =
    useViewerAccess();
  const utils = api.useUtils();

  if (isPending) {
    return <span className="text-sm text-zinc-500">Loading…</span>;
  }

  if (viewerUser) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href={`/user/${viewerUser.id}`}
          className="rounded px-2 py-1 text-sm text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          {viewerUser.name ?? viewerUser.email}
        </Link>
        {isAdmin && (
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

  if (rawUser && isPendingApproval) {
    return (
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-2 rounded px-2 py-1 text-sm text-zinc-400"
          title="Waiting for admin approval"
        >
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 text-zinc-500"
            aria-hidden="true"
          >
            <circle
              cx="10"
              cy="10"
              r="7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M10 6.5V10.2L12.8 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{rawUser.name ?? rawUser.email}</span>
        </div>
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
