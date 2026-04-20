import { useEffect, useRef } from "react";

// only scroll on page navigation/reload, don't mess with user scroll
export function useInitialActiveTopicScroll(
  activeTopicId: number | undefined,
  enabled: boolean,
) {
  const didInitialScroll = useRef(false);

  useEffect(() => {
    if (didInitialScroll.current) return;
    if (activeTopicId === undefined || !enabled) return;

    const el = document.querySelector<HTMLElement>(
      `[data-topic-id="${activeTopicId}"]`,
    );
    if (!el) return;
    el.scrollIntoView({ block: "start" });
    window.scrollTo({ top: 0, left: 0 });
    didInitialScroll.current = true;
  }, [activeTopicId, enabled]);
}
