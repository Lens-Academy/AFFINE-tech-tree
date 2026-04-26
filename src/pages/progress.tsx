import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect } from "react";

import { PageLayout } from "~/components/PageLayout";
import { useViewerAccess } from "~/hooks/useViewerAccess";

export default function ProgressPage() {
  const router = useRouter();
  const { viewerUser, isPending } = useViewerAccess();

  useEffect(() => {
    if (!viewerUser) return;
    void router.replace(`/progress/${viewerUser.id}`);
  }, [router, viewerUser]);

  return (
    <>
      <Head>
        <title>Progress | AFFINE Tech Tree</title>
      </Head>
      <PageLayout>
        <h1 className="mb-4 text-lg font-semibold text-zinc-100">Progress</h1>
        {isPending && <p className="text-zinc-500">Loading session...</p>}
        {!isPending && !viewerUser && (
          <p className="text-zinc-400">Please sign in to view progress.</p>
        )}
        {viewerUser && <p className="text-zinc-500">Redirecting…</p>}
      </PageLayout>
    </>
  );
}
