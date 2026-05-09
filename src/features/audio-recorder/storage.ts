// OPFS helpers used by the audio recorder UI on the main thread.
// The active recording is written by recorder.worker.ts via a
// FileSystemSyncAccessHandle; these helpers only list / read / delete
// completed files.

export const RECORDINGS_DIR = "recordings";

export type SavedRecording = {
  name: string;
  size: number;
  lastModified: number;
};

export type OpfsSupport = { ok: true } | { ok: false; reason: string };

export function checkSupport(): OpfsSupport {
  if (!("storage" in navigator) || !navigator.storage.getDirectory) {
    return { ok: false, reason: "OPFS (navigator.storage) not available" };
  }
  if (
    typeof FileSystemFileHandle === "undefined" ||
    !("createSyncAccessHandle" in FileSystemFileHandle.prototype)
  ) {
    return {
      ok: false,
      reason: "FileSystemFileHandle.createSyncAccessHandle not available",
    };
  }
  if (typeof Worker === "undefined") {
    return { ok: false, reason: "Web Workers not available" };
  }
  if (typeof MediaRecorder === "undefined") {
    return { ok: false, reason: "MediaRecorder not available" };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "getUserMedia not available" };
  }
  if (!pickMimeType()) {
    return { ok: false, reason: "no supported audio MIME type" };
  }
  return { ok: true };
}

async function getDir(): Promise<FileSystemDirectoryHandle> {
  const root = await navigator.storage.getDirectory();
  return root.getDirectoryHandle(RECORDINGS_DIR, { create: true });
}

export async function listRecordings(): Promise<SavedRecording[]> {
  const dir = await getDir();
  const out: SavedRecording[] = [];
  // values() is async iterable in supported browsers.
  const iter = (
    dir as unknown as {
      values: () => AsyncIterable<FileSystemHandle>;
    }
  ).values();
  for await (const entry of iter) {
    if (entry.kind !== "file") continue;
    const fh = entry as FileSystemFileHandle;
    const file = await fh.getFile();
    out.push({
      name: fh.name,
      size: file.size,
      lastModified: file.lastModified,
    });
  }
  out.sort((a, b) => b.lastModified - a.lastModified);
  return out;
}

export async function getRecordingFile(name: string): Promise<File> {
  const dir = await getDir();
  const fh = await dir.getFileHandle(name);
  return fh.getFile();
}

export async function deleteRecording(name: string): Promise<void> {
  const dir = await getDir();
  await dir.removeEntry(name);
}

export function pickMimeType(): { mime: string; ext: string } | null {
  const candidates: { mime: string; ext: string }[] = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/mp4", ext: "m4a" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildRecordingName(ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return (
    `rec-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}` +
    `${ms}.${ext}`
  );
}
