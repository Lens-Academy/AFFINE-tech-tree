import Link from "next/link";
import type { ReactNode } from "react";

import { InfoPane } from "~/components/InfoPane";
import { useActivePath } from "~/hooks/useActivePath";
import { useViewerAccess } from "~/hooks/useViewerAccess";
import { SUGGESTIONS_SHEET_URL } from "~/shared/constants";
import { api } from "~/utils/api";

type Tab = {
  label: string;
  href: string;
  external?: boolean;
  requiresAuth?: boolean;
  isActive: (pathname: string) => boolean;
};

const TABS: Tab[] = [
  {
    label: "Topics",
    href: "/",
    isActive: (p) => p === "/" || p.startsWith("/topic"),
  },
  {
    label: "Match",
    href: "/match",
    requiresAuth: true,
    isActive: (p) => p.startsWith("/match"),
  },
  {
    label: "Resources",
    href: "/resources",
    isActive: (p) => p === "/resources",
  },
  { label: "Graph", href: "/graph", isActive: (p) => p === "/graph" },
  {
    label: "Progress",
    href: "/progress",
    requiresAuth: true,
    isActive: (p) => p === "/progress",
  },
  {
    label: "Suggest",
    href: SUGGESTIONS_SHEET_URL,
    external: true,
    requiresAuth: true,
    isActive: () => false,
  },
];

const BASE =
  "group rounded-t-lg border border-b-0 px-4 py-2 text-sm font-medium transition";
const ACTIVE = `${BASE} border-zinc-800 bg-zinc-900`;
const INACTIVE = `${BASE} border-transparent bg-transparent hover:bg-zinc-900/50`;
const DISABLED = `${BASE} cursor-not-allowed border-transparent bg-transparent`;

const TEXT_BASE =
  "bg-linear-60 from-orange-400 to-zinc-100 bg-clip-text text-transparent";
const TEXT_ACTIVE = `${TEXT_BASE} to-200%`;
const TEXT_INACTIVE = `${TEXT_BASE} to-1% group-hover:to-100%`;
const TEXT_DISABLED = "text-zinc-600";

function TabItem({
  tab,
  isActive,
  disabled,
  suffix,
}: {
  tab: Tab;
  isActive: boolean;
  disabled: boolean;
  suffix?: ReactNode;
}) {
  const className = disabled ? DISABLED : isActive ? ACTIVE : INACTIVE;
  const textClass = disabled
    ? TEXT_DISABLED
    : isActive
      ? TEXT_ACTIVE
      : TEXT_INACTIVE;
  const label = (
    <span className="flex items-center gap-1.5">
      <span className={textClass}>{tab.label}</span>
      {suffix}
    </span>
  );
  if (disabled) {
    return (
      <span className={className} title="Sign in to use" aria-disabled="true">
        {label}
      </span>
    );
  }
  if (tab.external) {
    return (
      <a
        href={tab.href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
        {label}
      </a>
    );
  }
  return (
    <Link
      href={tab.href}
      className={className}
      aria-current={isActive ? "page" : undefined}
    >
      {label}
    </Link>
  );
}

export function PageTabs() {
  const pathname = useActivePath();
  const { viewerUser } = useViewerAccess();
  const incomingMatches = api.match.listIncoming.useQuery(undefined, {
    enabled: !!viewerUser,
  });
  const incomingCount = incomingMatches.data?.length ?? 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4">
      <InfoPane />
      <nav className="relative z-10 -mb-px flex gap-x-1 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {TABS.map((tab) => (
          <TabItem
            key={tab.label}
            tab={tab}
            isActive={tab.isActive(pathname)}
            disabled={!!tab.requiresAuth && !viewerUser}
            suffix={
              tab.href === "/match" && incomingCount > 0 ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-400 px-1 text-[10px] font-bold text-white">
                  {incomingCount > 9 ? "9+" : incomingCount}
                </span>
              ) : undefined
            }
          />
        ))}
      </nav>
    </div>
  );
}
