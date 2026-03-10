/**
 * Parse comma- or slash-separated tag strings.
 * Returns trimmed, non-empty tag names.
 */
export function parseTags(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,/]/)
    .map((t) => t.trim())
    .filter(Boolean);
}
