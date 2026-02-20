import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getLevelLabel } from "~/shared/understandingLevels";
import { api } from "~/utils/api";

export function NotificationBell() {
  const { data: transitions } = api.feedback.getRecentTransitions.useQuery();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (!transitions) return null;

  const pendingCount = transitions.filter(
    (t) => t.feedbackItems.length === 0,
  ).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
        title="Learning feedback"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {pendingCount > 0 && (
          <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-orange-400 text-[10px] font-bold text-white">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-80 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
          <div className="border-b border-zinc-700 px-4 py-3">
            <h3 className="text-sm text-zinc-100">Learning Feedback</h3>
          </div>
          {transitions.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-zinc-500">
              No level changes yet
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {transitions.map((t) => {
                const hasFeedback = t.feedbackItems.length > 0;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/topic/${t.topic.id}#feedback`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 transition hover:bg-zinc-800/80"
                    >
                      <span className="w-5 shrink-0 text-center text-sm">
                        {hasFeedback ? (
                          <span className="text-green-400">&#10003;</span>
                        ) : (
                          <span className="text-orange-400">&#9675;</span>
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm text-zinc-200">
                          {t.topic.name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          {t.fromLevel ? getLevelLabel(t.fromLevel) : "-"}
                          {" -> "}
                          {t.toLevel ? getLevelLabel(t.toLevel) : "-"}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
