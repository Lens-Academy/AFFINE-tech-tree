import Head from "next/head";

import { PageLayout } from "~/components/PageLayout";

export default function ProgressPage() {
  return (
    <>
      <Head>
        <title>Progress | AFFINE Tech Tree</title>
      </Head>
      <PageLayout>
        <h1 className="mb-4 text-3xl font-bold text-zinc-100">Progress</h1>
        <p className="text-zinc-500">TODO</p>
      </PageLayout>
    </>
  );
}
