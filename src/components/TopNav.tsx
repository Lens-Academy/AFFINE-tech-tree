import Link from "next/link";

import { AuthHeader } from "~/components/AuthHeader";

export function TopNav() {
  return (
    <div className="bg-zinc-950">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:min-h-16 md:py-2">
        <Link
          href="/"
          className="flex-none bg-linear-60 from-orange-400 to-zinc-100 to-15% bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-2xl"
        >
          AFFINE Tech Tree
        </Link>
        <AuthHeader />
      </div>
    </div>
  );
}
