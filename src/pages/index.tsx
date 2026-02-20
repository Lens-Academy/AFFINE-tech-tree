import Head from "next/head";
import { AuthHeader } from "~/components/AuthHeader";
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
      <main className="min-h-screen bg-zinc-950 px-4 py-6 md:px-8 md:py-10">
        <div className="mx-auto max-w-4xl">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="bg-linear-60 from-orange-400 to-zinc-100 to-15% bg-clip-text text-3xl font-bold tracking-tight text-transparent md:text-4xl">
              AFFINE Tech Tree
            </h1>
            <AuthHeader />
          </header>

          <TopicList />
        </div>
      </main>
    </>
  );
}
