import Head from "next/head";

import { PageLayout } from "~/components/PageLayout";
import { ProgressChart } from "~/features/progress-chart/ProgressChart";
import { api } from "~/utils/api";

export default function ProgressPage() {
  const { data, isLoading } = api.progress.overTime.useQuery();

  return (
    <>
      <Head>
        <title>Progress | AFFINE Tech Tree</title>
      </Head>
      <PageLayout>
        <h1 className="mb-4 text-lg font-semibold text-zinc-100">
          Your progress over time
        </h1>
        {isLoading && <p className="text-zinc-500">Loading…</p>}
        {data && <ProgressChart days={data.days} />}
      </PageLayout>
    </>
  );
}
