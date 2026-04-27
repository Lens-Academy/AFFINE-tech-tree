import Link from "next/link";

import { AvailabilityCircle } from "~/components/AvailabilityCircle";
import { NavTab, NAV_TAB_INACTIVE } from "~/components/NavTab";
import { NotificationBell } from "~/components/NotificationBell";
import { OtterLogo } from "~/components/OtterLogo";
import { TestEnvBadge } from "~/components/TestEnvBadge";
import { useLocalStorageBoolean } from "~/hooks/useLocalStorageBoolean";
import { useActivePath } from "~/hooks/useActivePath";
import { useSignOut } from "~/hooks/useSignOut";
import { useViewerAccess } from "~/hooks/useViewerAccess";
import { OTTER_LINK_VISIBLE_STORAGE_KEY } from "~/shared/devicePreferences";
import { GITHUB_REPO } from "~/shared/constants";
import { api } from "~/utils/api";

const OTTER_URL = "https://otter.ai/home";

function GitHubLink() {
  return (
    <a
      href={GITHUB_REPO}
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

function OtterLink() {
  return (
    <a
      href={OTTER_URL}
      // not _blank to support Android's Firefox setting to open links in app
      className={NAV_TAB_INACTIVE}
      title="Record transcript in Otter"
      aria-label="Record transcript in Otter"
    >
      <OtterLogo className="h-5 w-5 text-zinc-100 transition group-hover:text-orange-400" />
    </a>
  );
}

export function AuthHeader() {
  const activePath = useActivePath();
  const { rawUser, viewerUser, isPending, isPendingApproval, isAdmin } =
    useViewerAccess();
  const signOut = useSignOut();
  const [showOtterLink, , otterPreferenceLoaded] = useLocalStorageBoolean(
    OTTER_LINK_VISIBLE_STORAGE_KEY,
    true,
  );
  const availability = api.availability.getMyStatus.useQuery(undefined, {
    enabled: !!viewerUser,
  });

  if (isPending) {
    return <span className="text-sm text-zinc-500">Loading…</span>;
  }

  if (viewerUser) {
    const isOwnProfile = activePath === `/user/${viewerUser.id}`;
    const isAdminRoute = activePath.startsWith("/admin");
    return (
      <div className="ml-auto flex flex-nowrap items-center">
        <TestEnvBadge />
        <GitHubLink />
        <NotificationBell />
        <div className="ml-2 flex *:-ml-px *:first:ml-0 *:first:rounded-l-lg *:last:rounded-r-lg">
          {otterPreferenceLoaded && showOtterLink && <OtterLink />}
          {isAdmin && (
            <NavTab href="/admin" isActive={isAdminRoute}>
              Admin
            </NavTab>
          )}
          <NavTab
            href={`/user/${viewerUser.id}`}
            isActive={isOwnProfile}
            suffix={
              <AvailabilityCircle
                available={availability.data?.available ?? false}
                className="ml-0.5"
              />
            }
          >
            {viewerUser.name ?? viewerUser.email}
          </NavTab>
        </div>
      </div>
    );
  }

  if (rawUser && isPendingApproval) {
    return (
      <div className="ml-auto flex flex-nowrap items-center gap-3">
        <TestEnvBadge />
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
          onClick={() => void signOut()}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 transition hover:border-orange-500/50 hover:bg-zinc-700"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="ml-auto flex flex-nowrap items-center gap-3">
      <TestEnvBadge />
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
