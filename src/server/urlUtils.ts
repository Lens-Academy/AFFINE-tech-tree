/**
 * Normalises a URL string for deduplication: strips trailing slashes from the
 * path and preserves protocol, host, and query string.  Returns null if the
 * input cannot be parsed as a URL.
 */
export function normalizeUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    return `${url.protocol}//${url.host}${normalizedPath}${url.search}`;
  } catch {
    return null;
  }
}
