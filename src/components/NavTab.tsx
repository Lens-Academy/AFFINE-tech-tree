import Link from "next/link";
import type { ReactNode } from "react";

const BASE =
  "group border bg-zinc-900/50 px-4 py-2 text-sm font-medium transition";
const ACTIVE = `${BASE} relative z-10 border-orange-500`;
const INACTIVE = `${BASE} border-zinc-800 hover:border-zinc-700`;
const DISABLED = `${BASE} cursor-not-allowed border-zinc-800 opacity-50`;

const TEXT_BASE =
  "bg-linear-60 from-orange-400 to-zinc-100 bg-clip-text text-transparent";
const TEXT_ACTIVE = `${TEXT_BASE} to-200%`;
const TEXT_INACTIVE = `${TEXT_BASE} to-1% group-hover:to-100%`;
const TEXT_DISABLED = `${TEXT_BASE} to-1%`;

export function NavTab({
  href,
  external,
  isActive,
  disabled,
  disabledTitle,
  suffix,
  children,
}: {
  href: string;
  external?: boolean;
  isActive: boolean;
  disabled?: boolean;
  disabledTitle?: string;
  suffix?: ReactNode;
  children: ReactNode;
}) {
  const className = disabled ? DISABLED : isActive ? ACTIVE : INACTIVE;
  const textClass = disabled
    ? TEXT_DISABLED
    : isActive
      ? TEXT_ACTIVE
      : TEXT_INACTIVE;
  const label = (
    <span className="flex items-center gap-1.5">
      <span className={textClass}>{children}</span>
      {suffix}
    </span>
  );
  if (disabled) {
    return (
      <span className={className} title={disabledTitle} aria-disabled="true">
        {label}
      </span>
    );
  }
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
