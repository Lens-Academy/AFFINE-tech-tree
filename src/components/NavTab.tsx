import Link from "next/link";
import type { ReactNode } from "react";

export const NAV_TAB_BASE =
  "group border bg-zinc-900/50 px-4 py-2 text-sm font-medium transition";
export const NAV_TAB_ACTIVE = `${NAV_TAB_BASE} relative z-10 border-orange-500`;
export const NAV_TAB_INACTIVE = `${NAV_TAB_BASE} border-zinc-800 hover:border-zinc-700`;

export const NAV_TAB_TEXT_BASE =
  "bg-linear-60 from-orange-400 to-zinc-100 bg-clip-text text-transparent";
export const NAV_TAB_TEXT_ACTIVE = `${NAV_TAB_TEXT_BASE} to-200%`;
export const NAV_TAB_TEXT_INACTIVE = `${NAV_TAB_TEXT_BASE} to-1% group-hover:to-100%`;

export function NavTab({
  href,
  isActive,
  suffix,
  children,
}: {
  href: string;
  isActive: boolean;
  suffix?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={isActive ? NAV_TAB_ACTIVE : NAV_TAB_INACTIVE}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={isActive ? NAV_TAB_TEXT_ACTIVE : NAV_TAB_TEXT_INACTIVE}
        >
          {children}
        </span>
        {suffix}
      </span>
    </Link>
  );
}
