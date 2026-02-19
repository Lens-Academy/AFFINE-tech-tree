import Link from "next/link";

import { useToasts, type ToastData } from "~/hooks/useToastStore";

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastData;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-orange-500/30 bg-zinc-900 p-4 shadow-lg">
      <div className="flex-1">
        <p className="mb-2 text-sm text-zinc-300">
          How did you learn about{" "}
          <span className="text-zinc-100">{toast.topicName}</span>?
        </p>
        <Link
          href={`/topic/${toast.topicId}#feedback`}
          onClick={() => onDismiss(toast.id)}
          className="text-sm text-orange-400 underline decoration-orange-400/30 underline-offset-2 hover:text-orange-300"
        >
          Provide feedback
        </Link>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 text-zinc-500 hover:text-zinc-300"
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismissToast } = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-3">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}
