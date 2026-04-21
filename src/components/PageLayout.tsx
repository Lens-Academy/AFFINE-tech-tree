import type { ReactNode } from "react";

import { PageShell } from "~/components/PageShell";

export function PageLayout({ children }: { children: ReactNode }) {
  return (
    <PageShell>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 md:p-6">
        {children}
      </div>
    </PageShell>
  );
}
