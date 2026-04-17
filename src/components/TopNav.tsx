import { AuthHeader } from "~/components/AuthHeader";
import { NavTab } from "~/components/NavTab";
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

const BASE_TABS: Tab[] = [
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

export function TopNav() {
  const pathname = useActivePath();
  const { viewerUser } = useViewerAccess();
  const incomingMatches = api.match.listIncoming.useQuery(undefined, {
    enabled: !!viewerUser,
  });
  const incomingCount = incomingMatches.data?.length ?? 0;

  const renderGroup = (group: Tab[]) => (
    <div className="flex *:-ml-px *:first:ml-0">
      {group.map((tab) => {
        const disabled = !!tab.requiresAuth && !viewerUser;
        return (
          <NavTab
            key={tab.label}
            href={tab.href}
            external={tab.external}
            isActive={tab.isActive(pathname)}
            disabled={disabled}
            disabledTitle={disabled ? "Sign in to use" : undefined}
            suffix={
              tab.href === "/match" && incomingCount > 0 ? (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-400 px-1 text-[10px] font-bold text-white">
                  {incomingCount > 9 ? "9+" : incomingCount}
                </span>
              ) : undefined
            }
          >
            {tab.label}
          </NavTab>
        );
      })}
    </div>
  );

  return (
    <div className="bg-zinc-950/90 backdrop-blur md:sticky md:top-0 md:z-20">
      <div className="mx-auto flex max-w-5xl flex-wrap-reverse items-center justify-between gap-y-2 px-4 py-3 md:min-h-16 md:py-2">
        <nav className="flex min-w-0 flex-wrap items-center gap-y-1 [&>:first-child>:first-child]:rounded-l-lg [&>:last-child>:last-child]:rounded-r-lg">
          {renderGroup(BASE_TABS.slice(0, 3))}
          {renderGroup(BASE_TABS.slice(3))}
        </nav>
        <AuthHeader />
      </div>
    </div>
  );
}
