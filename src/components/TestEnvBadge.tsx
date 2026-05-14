import { useEffect, useRef, useState } from "react";

import { GITHUB_REPO } from "~/shared/constants";
import { formatDate } from "~/shared/formatDate";
const PRODUCTION_URL = "https://learn.affi.ne";

function isTestEnv() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host.includes("vercel.app");
}

export function TestEnvBadge() {
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setShow(isTestEnv());
  }, []);

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

  if (!show) return null;

  const commit = process.env.NEXT_PUBLIC_GIT_COMMIT ?? "";
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE ?? "";
  const shortCommit = commit.slice(0, 7);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded bg-orange-500/15 px-2 py-1 text-xs font-medium text-orange-400 transition hover:bg-orange-500/25"
      >
        Test
      </button>

      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-72 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
          <div className="px-4 py-3 text-sm leading-relaxed text-zinc-300">
            <p>
              This is a test environment. The database may be cleared at any
              time.
            </p>
            {buildDate && (
              <p className="mt-2 text-xs text-zinc-500">
                Deployed {formatDate(buildDate)}
                {shortCommit && (
                  <>
                    {" from "}
                    <a
                      href={`${GITHUB_REPO}/commit/${commit}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:text-orange-300"
                    >
                      {shortCommit}
                    </a>
                  </>
                )}
              </p>
            )}
            <p className="mt-2 text-xs text-zinc-500">
              Production will be available at{" "}
              <a
                href={PRODUCTION_URL}
                className="text-orange-400 hover:text-orange-300"
              >
                {PRODUCTION_URL}
              </a>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
