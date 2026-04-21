import type { ReactNode } from "react";

import { Footer } from "~/components/Footer";
import { PageTabs } from "~/components/PageTabs";
import { TopNav } from "~/components/TopNav";

export function PageShell({
  children,
  className = "",
  mainClassName = "max-w-5xl",
}: {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
}) {
  return (
    <div className={`flex min-h-screen flex-col bg-zinc-950 ${className}`}>
      <TopNav />
      <PageTabs />
      <main
        className={`mx-auto flex min-h-0 w-full flex-1 flex-col px-4 pb-4 md:pb-6 ${mainClassName}`}
      >
        {children}
      </main>
      <Footer />
    </div>
  );
}
