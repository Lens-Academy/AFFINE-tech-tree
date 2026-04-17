import Head from "next/head";
import { InfoPane } from "~/components/InfoPane";
import { PageLayout } from "~/components/PageLayout";
import { TopicList } from "~/components/TopicList";

export default function Home() {
  return (
    <>
      <Head>
        <title>AFFINE Tech Tree</title>
        <meta
          name="description"
          content="Track your progress through AI alignment training material"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <PageLayout>
        <h1 className="mb-6 bg-linear-60 from-orange-400 to-zinc-100 to-15% bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
          AFFINE Tech Tree
        </h1>
        <InfoPane />
        <TopicList />
      </PageLayout>
    </>
  );
}
