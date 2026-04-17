import Link from "next/link";
import type { ReactNode } from "react";

type Rounding = "left" | "right" | "both" | "none";

const BASE =
  "group border bg-zinc-900/50 px-4 py-2 text-sm font-medium transition";
const ACTIVE = `${BASE} relative z-10 border-orange-500`;
const INACTIVE = `${BASE} border-zinc-800 hover:border-zinc-700`;

const TEXT_BASE =
  "bg-linear-60 from-orange-400 to-zinc-100 bg-clip-text text-transparent";
const TEXT_ACTIVE = `${TEXT_BASE} to-200%`;
const TEXT_INACTIVE = `${TEXT_BASE} to-1% group-hover:to-100%`;

const ROUNDING: Record<Rounding, string> = {
  left: "rounded-lg md:rounded-r-none",
  right: "rounded-lg md:rounded-l-none",
  both: "rounded-lg",
  none: "rounded-lg md:rounded-none",
};

export function NavTab({
  href,
  external,
  isActive,
  rounding,
  overlap,
  suffix,
  children,
}: {
  href: string;
  external?: boolean;
  isActive: boolean;
  rounding: Rounding;
  overlap?: boolean;
  suffix?: ReactNode;
  children: ReactNode;
}) {
  const className = [
    isActive ? ACTIVE : INACTIVE,
    ROUNDING[rounding],
    overlap ? "md:-ml-px" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const label = (
    <span className="flex items-center gap-1.5">
      <span className={isActive ? TEXT_ACTIVE : TEXT_INACTIVE}>{children}</span>
      {suffix}
    </span>
  );
  if (external) {
    return (
      <a
        href={href}
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
      href={href}
      className={className}
      aria-current={isActive ? "page" : undefined}
    >
      {label}
    </Link>
  );
}
