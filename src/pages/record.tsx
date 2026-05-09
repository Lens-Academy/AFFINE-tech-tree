import Head from "next/head";
import dynamic from "next/dynamic";

import { PageLayout } from "~/components/PageLayout";

const AudioRecorder = dynamic(
  () =>
    import("~/features/audio-recorder/AudioRecorder").then(
      (m) => m.AudioRecorder,
    ),
  {
    ssr: false,
    loading: () => <p className="text-zinc-500">Loading recorder…</p>,
  },
);

export default function RecordPage() {
  return (
    <>
      <Head>
        <title>Record — AFFINE Tech Tree</title>
      </Head>
      <PageLayout>
        <h1 className="mb-4 text-lg font-medium text-zinc-100">
          Record seminar audio
        </h1>
        <AudioRecorder />
      </PageLayout>
    </>
  );
}
