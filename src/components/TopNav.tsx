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
    isActive: (p) => p === "/match" || p.startsWith("/match/"),
  },
  {
    label: "Resources",
    href: "/resources",
    isActive: (p) => p === "/resources",
  },
  { label: "Graph", href: "/graph", isActive: (p) => p === "/graph" },
  { label: "Progress", href: "/progress", isActive: (p) => p === "/progress" },
  {
    label: "Suggest",
    href: SUGGESTIONS_SHEET_URL,
    external: true,
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
  const lastIndex = BASE_TABS.length - 1;

  return (
    <div className="bg-zinc-950/90 backdrop-blur md:sticky md:top-0 md:z-20">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-3 md:h-16 md:flex-row md:items-center md:justify-between md:gap-3 md:px-8 md:py-0">
        <nav className="flex min-w-0 flex-wrap items-center gap-1 md:flex-nowrap md:gap-0 md:overflow-x-auto">
          {BASE_TABS.map((tab, index) => (
            <NavTab
              key={tab.label}
              href={tab.href}
              external={tab.external}
              isActive={tab.isActive(pathname)}
              suffix={
                tab.href === "/match" && incomingCount > 0 ? (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-400 px-1 text-[10px] font-bold text-white">
                    {incomingCount > 9 ? "9+" : incomingCount}
                  </span>
                ) : undefined
              }
              rounding={
                index === 0 ? "left" : index === lastIndex ? "right" : "none"
              }
              overlap={index > 0}
            >
              {tab.label}
            </NavTab>
          ))}
        </nav>
        <AuthHeader />
      </div>
    </div>
  );
}
