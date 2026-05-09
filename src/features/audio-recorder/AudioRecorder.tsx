import { useCallback, useEffect, useRef, useState } from "react";

import { formatDate } from "~/shared/formatDate";

import {
  buildRecordingName,
  checkSupport,
  deleteRecording,
  formatBytes,
  getRecordingFile,
  listRecordings,
  pickMimeType,
  RECORDINGS_DIR,
  type SavedRecording,
} from "./storage";

const TIMESLICE_MS = 1000;

type RecorderState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "recording"; startedAt: number; bytes: number }
  | { kind: "stopping" }
  | { kind: "error"; message: string };

type WakeLockSentinel = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
};

type WorkerMsg = {
  type: "opened" | "wrote" | "closed" | "error";
  size?: number;
  message?: string;
};

export function AudioRecorder() {
  const [support] = useState(() => checkSupport());
  const [state, setState] = useState<RecorderState>({ kind: "idle" });
  const [recordings, setRecordings] = useState<SavedRecording[]>([]);
  const [now, setNow] = useState(Date.now());

  const workerRef = useRef<Worker | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  // Promise chain that serializes Blob.arrayBuffer() reads + worker writes,
  // so chunks reach OPFS in the same order MediaRecorder produced them.
  const writeChainRef = useRef<Promise<void>>(Promise.resolve());
  const stoppedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setRecordings(await listRecordings());
    } catch (err: unknown) {
      console.error("listRecordings failed", err);
    }
  }, []);

  useEffect(() => {
    if (support.ok) void refresh();
  }, [support.ok, refresh]);

  useEffect(() => {
    if (state.kind !== "recording") return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [state.kind]);

  // Warn before navigation/close while recording, and re-request the wake lock
  // when the tab returns to foreground (the platform auto-releases it on hide).
  useEffect(() => {
    if (state.kind !== "recording") return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const wl = (navigator as WakeLockNavigator).wakeLock;
      if (!wl) return;
      wl.request("screen")
        .then((lock) => {
          wakeLockRef.current = lock;
        })
        .catch(() => undefined);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [state.kind]);

  const cleanup = useCallback(() => {
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    wakeLockRef.current?.release().catch(() => undefined);
    wakeLockRef.current = null;
    writeChainRef.current = Promise.resolve();
  }, []);

  // Best-effort cleanup on unmount: tell the worker to close so the OPFS file
  // is flushed before we terminate the worker. The synchronously-emitted final
  // chunk may still be lost (its arrayBuffer() resolves async); explicit Stop
  // is the durable path. Crashes don't run cleanup, so they keep all chunks.
  useEffect(
    () => () => {
      const worker = workerRef.current;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
      if (worker) {
        try {
          worker.postMessage({ type: "close" });
        } catch {
          // ignore
        }
      }
      cleanup();
    },
    [cleanup],
  );

  const start = useCallback(async () => {
    if (!support.ok) return;
    setState({ kind: "starting" });
    stoppedRef.current = false;
    writeChainRef.current = Promise.resolve();
    try {
      const picked = pickMimeType();
      if (!picked) throw new Error("no supported audio MIME type");

      try {
        await navigator.storage.persist?.();
      } catch {
        // Best-effort.
      }

      // Prove OPFS / sync-access-handle works before prompting for the mic, so
      // unsupported browsers (e.g. private mode) don't surface a stale mic
      // permission grant when the recording can't actually be persisted.
      const name = buildRecordingName(picked.ext);
      const worker = new Worker(
        new URL("./recorder.worker.ts", import.meta.url),
        { type: "module" },
      );
      workerRef.current = worker;

      await new Promise<void>((resolve, reject) => {
        const onMsg = (event: MessageEvent<WorkerMsg>) => {
          if (event.data.type === "opened") {
            worker.removeEventListener("message", onMsg);
            resolve();
          } else if (event.data.type === "error") {
            worker.removeEventListener("message", onMsg);
            reject(new Error(event.data.message ?? "worker error"));
          }
        };
        worker.addEventListener("message", onMsg);
        worker.postMessage({ type: "open", dir: RECORDINGS_DIR, name });
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      worker.addEventListener("message", (event: MessageEvent<WorkerMsg>) => {
        const data = event.data;
        if (data.type === "wrote" && typeof data.size === "number") {
          const size = data.size;
          setState((prev) =>
            prev.kind === "recording" ? { ...prev, bytes: size } : prev,
          );
        } else if (data.type === "error" && !stoppedRef.current) {
          console.error("recorder worker error", data.message);
          stoppedRef.current = true;
          cleanup();
          setState({ kind: "error", message: data.message ?? "worker error" });
        }
      });

      const recorder = new MediaRecorder(stream, { mimeType: picked.mime });
      recorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size === 0) return;
        const blob = event.data;
        // Serialize: each write waits for the previous arrayBuffer() + post.
        writeChainRef.current = writeChainRef.current
          .then(() => blob.arrayBuffer())
          .then((buf) => {
            workerRef.current?.postMessage({ type: "write", chunk: buf }, [
              buf,
            ]);
          })
          .catch((err: unknown) => {
            console.error("chunk write failed", err);
          });
      });

      recorder.addEventListener("error", (event) => {
        const err = (event as Event & { error?: { message?: string } }).error;
        stoppedRef.current = true;
        cleanup();
        setState({ kind: "error", message: err?.message ?? "recorder error" });
      });

      try {
        const lock = await (navigator as WakeLockNavigator).wakeLock?.request(
          "screen",
        );
        if (lock) wakeLockRef.current = lock;
      } catch {
        // Wake lock is best-effort.
      }

      recorder.start(TIMESLICE_MS);
      setState({ kind: "recording", startedAt: Date.now(), bytes: 0 });
    } catch (err: unknown) {
      cleanup();
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [cleanup, support.ok]);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    const worker = workerRef.current;
    if (!recorder || !worker) return;
    stoppedRef.current = true;
    setState({ kind: "stopping" });

    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });

    // Wait for the final chunk's arrayBuffer() + postMessage to flush through
    // the serialized chain before we ask the worker to close the OPFS handle.
    await writeChainRef.current;

    // Resolve on "closed", "error", or a 5s safety timeout — otherwise a
    // worker that throws (e.g. flush() under quota pressure) or dies silently
    // would leave the UI stuck in "stopping" with no way to start again.
    const closeError = await new Promise<string | null>((resolve) => {
      const finish = (err: string | null) => {
        worker.removeEventListener("message", onMsg);
        clearTimeout(timer);
        resolve(err);
      };
      const onMsg = (event: MessageEvent<WorkerMsg>) => {
        if (event.data.type === "closed") finish(null);
        else if (event.data.type === "error")
          finish(event.data.message ?? "worker close error");
      };
      const timer = setTimeout(() => finish("worker close timed out"), 5000);
      worker.addEventListener("message", onMsg);
      worker.postMessage({ type: "close" });
    });

    cleanup();
    if (closeError) {
      setState({ kind: "error", message: closeError });
    } else {
      setState({ kind: "idle" });
    }
    void refresh();
  }, [cleanup, refresh]);

  const download = useCallback(async (name: string) => {
    const file = await getRecordingFile(name);
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  const remove = useCallback(
    async (name: string) => {
      if (!window.confirm(`Delete ${name}?`)) return;
      await deleteRecording(name);
      await refresh();
    },
    [refresh],
  );

  if (!support.ok) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
        <p className="font-medium">
          In-browser recording is not supported here.
        </p>
        <p className="mt-1 text-red-200/80">
          Reason: {support.reason}. Use a recent Chrome, Edge, or Firefox on
          Android, or a desktop equivalent.
        </p>
      </div>
    );
  }

  const isRecording = state.kind === "recording";
  const elapsedMs = state.kind === "recording" ? now - state.startedAt : 0;
  const elapsed = formatElapsed(elapsedMs);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {!isRecording &&
            state.kind !== "starting" &&
            state.kind !== "stopping" && (
              <button
                type="button"
                onClick={() => void start()}
                className="rounded-lg border border-orange-500/50 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-300 transition hover:bg-orange-500/20"
              >
                Start recording
              </button>
            )}
          {state.kind === "starting" && (
            <span className="text-sm text-zinc-400">
              Requesting microphone…
            </span>
          )}
          {isRecording && (
            <>
              <button
                type="button"
                onClick={() => void stop()}
                className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
              >
                Stop
              </button>
              <span
                className="inline-flex h-3 w-3 animate-pulse rounded-full bg-red-500"
                aria-label="Recording"
              />
              <span className="font-mono text-sm text-zinc-200">{elapsed}</span>
              <span className="text-sm text-zinc-400">
                {formatBytes(state.bytes)} written
              </span>
            </>
          )}
          {state.kind === "stopping" && (
            <span className="text-sm text-zinc-400">Finishing…</span>
          )}
        </div>
        {state.kind === "error" && (
          <p className="mt-3 text-sm text-red-300">Error: {state.message}</p>
        )}
        <p className="mt-3 text-xs text-zinc-500">
          Audio is written to the browser&rsquo;s private storage every{" "}
          {TIMESLICE_MS / 1000}s, so a crash or battery loss only loses the last
          second. Keep this tab open and visible while recording. When you stop,
          tap <strong>Download</strong> to save the file via your
          browser&rsquo;s downloads, then upload it to Google Drive.
        </p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-zinc-300">
          Saved recordings
        </h2>
        {recordings.length === 0 ? (
          <p className="text-sm text-zinc-500">No recordings yet.</p>
        ) : (
          <ul className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
            {recordings.map((rec) => (
              <li
                key={rec.name}
                className="flex flex-wrap items-center gap-3 p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-zinc-200">
                    {rec.name}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {formatBytes(rec.size)} ·{" "}
                    {formatDate(new Date(rec.lastModified))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void download(rec.name)}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100 transition hover:border-orange-500/50 hover:bg-zinc-700"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => void remove(rec.name)}
                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-red-500/50 hover:text-red-300"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
