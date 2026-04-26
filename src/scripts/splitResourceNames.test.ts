import { describe, it, expect } from "vitest";

/**
 * Split the Resources cell value into individual resource names.
 * Splits on commas, but only when outside quotes.
 * Handles CSV escaped quotes ("" → ").
 * Strips outer wrapper quotes and unescapes doubled quotes.
 */
function splitResourceNames(raw: string): string[] {
  if (!raw.trim()) return [];

  let insideQuotes = false;
  let lastSplitPos = 0;
  const results: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '"') {
      // Check if this is an escaped quote ("")
      if (i + 1 < raw.length && raw[i + 1] === '"') {
        i++; // Skip the second quote of the pair
      } else {
        // Regular quote - toggle inside/outside state
        insideQuotes = !insideQuotes;
      }
    } else if (!insideQuotes && raw[i] === ",") {
      results.push(raw.slice(lastSplitPos, i));
      lastSplitPos = i + 1;
    }
  }

  // Capture the final item (everything after the last comma)
  if (lastSplitPos < raw.length) {
    results.push(raw.slice(lastSplitPos));
  }

  // Clean up each item: strip leading comma/space, strip outer quotes, unescape doubled quotes
  return results
    .map((item) => {
      let s = item
        .replace(/^,?\s*/, "")
        .replace(/,?\s*$/, "")
        .trim();
      if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) {
        s = s.slice(1, -1);
      }
      return s.replace(/""/g, '"');
    })
    .filter(Boolean);
}

describe("splitResourceNames", () => {
  it("splits simple comma-separated items", () => {
    expect(splitResourceNames("Resource A, Resource B, Resource C")).toEqual([
      "Resource A",
      "Resource B",
      "Resource C",
    ]);
  });

  it("handles quoted items with commas inside", () => {
    expect(splitResourceNames('"Resource A, with comma", Resource B')).toEqual([
      "Resource A, with comma",
      "Resource B",
    ]);
  });

  it("unescapes doubled quotes", () => {
    expect(
      splitResourceNames(
        '"""Sharp Left Turn"" discourse: An opinionated review"',
      ),
    ).toEqual(['"Sharp Left Turn" discourse: An opinionated review']);
  });

  it("handles multiple quoted items", () => {
    expect(
      splitResourceNames(
        '"""Without specific countermeasures, the easiest path to transformative AI likely leads to AI takeover""", """Without fundamental advances, misalignment and catastrophe are the default outcomes of training powerful AI"""',
      ),
    ).toEqual([
      '"Without specific countermeasures, the easiest path to transformative AI likely leads to AI takeover"',
      '"Without fundamental advances, misalignment and catastrophe are the default outcomes of training powerful AI"',
    ]);
  });

  it("handles mix of quoted and unquoted", () => {
    expect(
      splitResourceNames('Simple Resource, "Quoted, with comma", Another One'),
    ).toEqual(["Simple Resource", "Quoted, with comma", "Another One"]);
  });

  it("handles empty string", () => {
    expect(splitResourceNames("")).toEqual([]);
  });

  it("handles single item", () => {
    expect(splitResourceNames("Single Resource")).toEqual(["Single Resource"]);
  });

  it("handles trailing comma", () => {
    expect(splitResourceNames("Resource A, Resource B,")).toEqual([
      "Resource A",
      "Resource B",
    ]);
  });
});
