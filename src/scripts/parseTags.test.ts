import { describe, expect, it } from "vitest";
import { parseTags } from "./parseTags";

describe("parseTags", () => {
  it("returns empty array for undefined", () => {
    expect(parseTags(undefined)).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(parseTags("")).toEqual([]);
  });

  it("returns empty array for whitespace-only string", () => {
    expect(parseTags("   \n\t  ")).toEqual([]);
  });

  it("splits on comma", () => {
    expect(parseTags("a, b, c")).toEqual(["a", "b", "c"]);
  });

  it("splits on slash", () => {
    expect(parseTags("a / b / c")).toEqual(["a", "b", "c"]);
  });

  it("handles mixed comma and slash", () => {
    expect(parseTags("a, b/c, d")).toEqual(["a", "b", "c", "d"]);
  });

  it("trims whitespace around each tag", () => {
    expect(parseTags("  foo  ,  bar  /  baz  ")).toEqual(["foo", "bar", "baz"]);
  });

  it("filters out empty segments", () => {
    expect(parseTags("a,,b,/c,")).toEqual(["a", "b", "c"]);
  });
});
