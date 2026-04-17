import type { ReactNode } from "react";

import { TopNav } from "~/components/TopNav";

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-950">
      <TopNav />
      <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">{children}</div>
    </main>
  );
}
