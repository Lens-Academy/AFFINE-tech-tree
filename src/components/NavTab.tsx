import Link from "next/link";
import type { ReactNode } from "react";

const BASE =
  "group border bg-zinc-900/50 px-4 py-2 text-sm font-medium transition";
const ACTIVE = `${BASE} relative z-10 border-orange-500`;
const INACTIVE = `${BASE} border-zinc-800 hover:border-zinc-700`;

const TEXT_BASE =
  "bg-linear-60 from-orange-400 to-zinc-100 bg-clip-text text-transparent";
const TEXT_ACTIVE = `${TEXT_BASE} to-200%`;
const TEXT_INACTIVE = `${TEXT_BASE} to-1% group-hover:to-100%`;

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
      className={isActive ? ACTIVE : INACTIVE}
      aria-current={isActive ? "page" : undefined}
    >
      <span className="flex items-center gap-1.5">
        <span className={isActive ? TEXT_ACTIVE : TEXT_INACTIVE}>
          {children}
        </span>
        {suffix}
      </span>
    </Link>
  );
}
