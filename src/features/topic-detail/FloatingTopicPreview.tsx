import type { RefObject } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { computePaneWidth } from "~/features/topic-detail/paneLayout";
import { TopicDetail } from "~/features/topic-detail/TopicDetail";

type Rect = { x: number; y: number; width: number; height: number };

const MIN_HEIGHT = 280;

/**
 * Sticky preview column for a topic. The pane follows the anchor's vertical
 * bounds as the user scrolls, so it reads as a section of the page and gets
 * tucked up when the footer scrolls into view.
 */
export function FloatingTopicPreview({
  topicId,
  onClose,
  onSelectTopic,
  anchorRef,
  animateIn = false,
}: {
  topicId: number;
  onClose: () => void;
  onSelectTopic: (topicId: number) => void;
  anchorRef: RefObject<HTMLElement | null>;
  /** Play the slide-in animation on mount. False on deep-link / page reload. */
  animateIn?: boolean;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  // Off-screen on first paint, then transitions to its resting position for a slide-in reveal.
  // Skipped on deep-link / reload and for users who prefer reduced motion.
  const [slidIn, setSlidIn] = useState(
    () => !animateIn || prefersReducedMotion(),
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const computeRect = useCallback((): Rect | null => {
    const anchor = anchorRef.current?.getBoundingClientRect();
    if (!anchor) return null;
    const vh = window.innerHeight;
    const width = computePaneWidth(window.innerWidth, anchor.width);
    // Top sticks to the anchor's top but stays in the viewport.
    // Bottom follows the viewport, but tucks up when the anchor's bottom rises (footer in view).
    const top = Math.max(0, anchor.top);
    const bottom = Math.max(top + MIN_HEIGHT, Math.min(vh, anchor.bottom));
    return {
      x: anchor.right - width,
      y: top,
      width,
      height: bottom - top,
    };
  }, [anchorRef]);

  // Move focus into the dialog on open; restore it to the opener on close.
  useEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current?.focus();
    return () => {
      const prev = previouslyFocusedRef.current;
      if (prev && document.body.contains(prev)) prev.focus();
    };
  }, []);

  // Initial position + keep it pinned to the anchor as the page scrolls/resizes/grows.
  // ResizeObserver catches the common case where the graph data arrives after mount
  // (deep link) and the anchor grows from a tiny loading box to the real SVG height.
  useEffect(() => {
    const update = () => {
      const next = computeRect();
      if (next) setRect(next);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const el = anchorRef.current;
    const observer =
      el && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;
    observer?.observe(el!);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [computeRect, anchorRef]);

  // Trigger the slide-in on the next frame after the initial rect mounts.
  useEffect(() => {
    if (!rect || slidIn) return;
    const id = requestAnimationFrame(() => setSlidIn(true));
    return () => cancelAnimationFrame(id);
  }, [rect, slidIn]);

  // ESC closes the preview unless another handler already took it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!rect) return null;

  return (
    <div
      aria-hidden={!slidIn}
      className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Topic preview"
        aria-modal="false"
        tabIndex={-1}
        className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 outline-none"
        style={{
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          transform: slidIn ? "translateX(0)" : "translateX(calc(100% + 32px))",
          opacity: slidIn ? 1 : 0,
          transition: "transform 220ms ease-out, opacity 220ms ease-out",
        }}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-zinc-800 bg-zinc-900/95 px-3 py-2 text-xs text-zinc-400 select-none">
          <span className="font-medium text-zinc-300">Topic preview</span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            title="Close"
            className="rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            <svg
              viewBox="0 0 20 20"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              className="h-4 w-4"
              strokeWidth={1.5}
            >
              <path d="M5 5L15 15M15 5L5 15" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <TopicDetail
            topicId={topicId}
            onSelectTopic={onSelectTopic}
            className="max-w-none"
          />
        </div>
      </div>
    </div>
  );
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
