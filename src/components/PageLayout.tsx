import type { ReactNode } from "react";

import { InfoPane } from "~/components/InfoPane";
import { PageTabs } from "~/components/PageTabs";
import { TopNav } from "~/components/TopNav";

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-950">
      <TopNav />
      <div className="mx-auto max-w-5xl px-4 pb-2">
        <InfoPane />
      </div>
      <PageTabs />
      <div className="mx-auto max-w-5xl px-4 pb-4 md:pb-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 md:p-6">
          {children}
        </div>
      </div>
    </main>
  );
}
