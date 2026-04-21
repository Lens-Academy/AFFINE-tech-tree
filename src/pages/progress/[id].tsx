import Head from "next/head";
import { useRouter } from "next/router";

import { PageLayout } from "~/components/PageLayout";
import { ProgressChart } from "~/features/progress-chart/ProgressChart";
import { useViewerAccess } from "~/hooks/useViewerAccess";
import { api } from "~/utils/api";

function possessive(name: string) {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

export default function UserProgressPage() {
  const router = useRouter();
  const userId = typeof router.query.id === "string" ? router.query.id : null;
  const { viewerUser, isPending: viewerPending } = useViewerAccess();
  const progress = api.progress.overTime.useQuery(
    { userId: userId ?? "" },
    { enabled: !!viewerUser && !!userId },
  );

  const displayName =
    progress.data?.user.name ?? progress.data?.user.email ?? "User";
  const heading = `${possessive(displayName)} progress over time`;

  return (
    <>
      <Head>
        <title>
          {progress.data
            ? `${heading} | AFFINE Tech Tree`
            : "Progress | AFFINE Tech Tree"}
        </title>
      </Head>
      <PageLayout>
        <h1 className="mb-4 text-lg font-semibold text-zinc-100">{heading}</h1>
        {viewerPending && <p className="text-zinc-500">Loading session...</p>}
        {!viewerPending && !viewerUser && (
          <p className="text-zinc-400">Please sign in to view progress.</p>
        )}
        {progress.isLoading && viewerUser && (
          <p className="text-zinc-500">Loading…</p>
        )}
        {progress.error && (
          <p className="text-red-400">{progress.error.message}</p>
        )}
        {progress.data && <ProgressChart days={progress.data.days} />}
      </PageLayout>
    </>
  );
}
