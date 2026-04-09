import Link from "next/link";

import { useViewerAccess } from "~/hooks/useViewerAccess";
import { authClient } from "~/server/better-auth/client";
import { NotificationBell } from "~/components/NotificationBell";
import { api } from "~/utils/api";

const GITHUB_URL = "https://github.com/Lens-Academy/AFFINE-tech-tree";

function GitHubLink() {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="rounded p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
      title="View source on GitHub"
    >
      <svg viewBox="0 0 16 16" fill="currentColor" className="h-5 w-5">
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
    </a>
  );
}

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
        <GitHubLink />
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
        <GitHubLink />
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
    <div className="flex items-center gap-3">
      <GitHubLink />
      <Link
        href="/auth"
        className="rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-400 transition hover:bg-orange-500/20"
      >
        Sign in
      </Link>
    </div>
  );
}
