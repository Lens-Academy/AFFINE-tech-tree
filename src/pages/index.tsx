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
        <InfoPane />
        <TopicList />
      </PageLayout>
    </>
  );
}
