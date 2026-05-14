// Dedicated Worker that owns an OPFS file via FileSystemSyncAccessHandle.
// Each MediaRecorder chunk is appended and flushed, so the recording
// survives crashes / battery loss.

type SyncAccessHandle = {
  write: (buf: ArrayBuffer | ArrayBufferView, opts?: { at?: number }) => number;
  flush: () => void;
  close: () => void;
  getSize: () => number;
  truncate: (newSize: number) => void;
};

type FileHandleWithSync = FileSystemFileHandle & {
  createSyncAccessHandle: () => Promise<SyncAccessHandle>;
};

type InMessage =
  | { type: "open"; dir: string; name: string }
  | { type: "write"; chunk: ArrayBuffer }
  | { type: "close" };

type OutMessage =
  | { type: "opened"; size: number }
  | { type: "wrote"; size: number }
  | { type: "closed" }
  | { type: "error"; message: string };

const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<InMessage>) => void) | null;
  postMessage: (msg: OutMessage) => void;
};

let handle: SyncAccessHandle | null = null;
let position = 0;

async function open(dirName: string, name: string) {
  const root = await navigator.storage.getDirectory();
  const dir = await root.getDirectoryHandle(dirName, { create: true });
  const fileHandle = (await dir.getFileHandle(name, {
    create: true,
  })) as FileHandleWithSync;
  handle = await fileHandle.createSyncAccessHandle();
  position = handle.getSize();
  ctx.postMessage({ type: "opened", size: position });
}

ctx.onmessage = (event) => {
  const msg = event.data;
  try {
    if (msg.type === "open") {
      void open(msg.dir, msg.name).catch((err: unknown) => {
        ctx.postMessage({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      });
      return;
    }
    if (msg.type === "write") {
      if (!handle) throw new Error("write before open");
      const written = handle.write(msg.chunk, { at: position });
      position += written;
      handle.flush();
      ctx.postMessage({ type: "wrote", size: position });
      return;
    }
    if (msg.type === "close") {
      if (handle) {
        handle.flush();
        handle.close();
        handle = null;
      }
      ctx.postMessage({ type: "closed" });
      return;
    }
  } catch (err: unknown) {
    ctx.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
