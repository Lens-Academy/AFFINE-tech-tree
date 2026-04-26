// Shared layout numbers for the graph-page topic preview.
// `src/pages/graph.tsx` hard-codes `md:pr-[min(60vw,560px)]` that must match
// MOBILE_BREAKPOINT, TABLET_WIDTH_RATIO, and MAX_WIDTH here -- Tailwind JIT
// needs the literal class name, so the CSS side can't import these constants.

export const MAX_WIDTH = 560;
export const MOBILE_BREAKPOINT = 768;
export const TABLET_WIDTH_RATIO = 0.6;

/**
 * Two discrete modes: phone takes the full anchor (single column),
 * tablet+ caps at `min(MAX_WIDTH, viewportWidth * TABLET_WIDTH_RATIO)`.
 * Never returns an intermediate state that would sit alongside a wider anchor
 * without matching reserved space on the container.
 */
export function computePaneWidth(
  viewportWidth: number,
  anchorWidth: number,
): number {
  if (viewportWidth < MOBILE_BREAKPOINT) return anchorWidth;
  return Math.min(MAX_WIDTH, viewportWidth * TABLET_WIDTH_RATIO, anchorWidth);
}
