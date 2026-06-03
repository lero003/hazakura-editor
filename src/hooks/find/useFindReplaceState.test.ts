import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFindReplaceState } from "./useFindReplaceState";

describe("useFindReplaceState", () => {
  it("starts with empty queries, hidden, default options, zero matches", () => {
    const { result } = renderHook(() => useFindReplaceState(""));

    expect(result.current.findQuery).toBe("");
    expect(result.current.replaceQuery).toBe("");
    expect(result.current.findVisible).toBe(false);
    expect(result.current.searchOptions).toEqual({
      caseSensitive: false,
      wholeWord: false,
      regex: false,
    });
    expect(result.current.activeMatchIndex).toBe(0);
    expect(result.current.findMatchCount).toBe(0);
    expect(result.current.findMatches).toEqual([]);
    expect(result.current.invalidRegex).toBe(false);
  });

  it("setters update state without affecting unrelated fields", () => {
    const { result } = renderHook(() => useFindReplaceState("hello"));

    act(() => {
      result.current.setFindQuery("hello");
      result.current.setReplaceQuery("world");
      result.current.setFindVisible(true);
      result.current.setActiveMatchIndex(0);
    });

    expect(result.current.findQuery).toBe("hello");
    expect(result.current.replaceQuery).toBe("world");
    expect(result.current.findVisible).toBe(true);
    expect(result.current.activeMatchIndex).toBe(0);
    expect(result.current.searchOptions).toEqual({
      caseSensitive: false,
      wholeWord: false,
      regex: false,
    });
  });

  it("counts case-insensitive plain matches in the source", () => {
    const { result } = renderHook(() =>
      useFindReplaceState("Hello hello HELLO world"),
    );

    act(() => {
      result.current.setFindQuery("hello");
    });

    expect(result.current.findMatchCount).toBe(3);
    expect(result.current.findMatches.map((m) => m.from)).toEqual([0, 6, 12]);
  });

  it("respects case-sensitive matching when the option is on", () => {
    const { result } = renderHook(() =>
      useFindReplaceState("Hello hello HELLO"),
    );

    act(() => {
      result.current.setSearchOptions({
        caseSensitive: true,
        wholeWord: false,
        regex: false,
      });
      result.current.setFindQuery("hello");
    });

    expect(result.current.findMatchCount).toBe(1);
    expect(result.current.findMatches[0]).toEqual({ from: 6, to: 11 });
  });

  it("respects whole-word matching when the option is on", () => {
    const { result } = renderHook(() =>
      useFindReplaceState("cat catalog scattered cat"),
    );

    act(() => {
      result.current.setSearchOptions({
        caseSensitive: false,
        wholeWord: true,
        regex: false,
      });
      result.current.setFindQuery("cat");
    });

    expect(result.current.findMatchCount).toBe(2);
    expect(result.current.findMatches.map((m) => m.from)).toEqual([0, 22]);
  });

  it("returns regex matches and never flags invalidRegex for a valid pattern", () => {
    const { result } = renderHook(() =>
      useFindReplaceState("foo123 bar456 baz789"),
    );

    act(() => {
      result.current.setSearchOptions({
        caseSensitive: false,
        wholeWord: false,
        regex: true,
      });
      result.current.setFindQuery("\\d+");
    });

    expect(result.current.findMatchCount).toBe(3);
    expect(result.current.invalidRegex).toBe(false);
  });

  it("sets invalidRegex for a malformed regex and returns no matches", () => {
    const { result } = renderHook(() => useFindReplaceState("anything"));

    act(() => {
      result.current.setSearchOptions({
        caseSensitive: false,
        wholeWord: false,
        regex: true,
      });
      result.current.setFindQuery("(unclosed");
    });

    expect(result.current.invalidRegex).toBe(true);
    expect(result.current.findMatchCount).toBe(0);
  });

  it("does not flag invalidRegex when regex option is off", () => {
    const { result } = renderHook(() => useFindReplaceState("anything"));

    act(() => {
      result.current.setFindQuery("(unclosed");
    });

    expect(result.current.invalidRegex).toBe(false);
  });

  it("recomputes matches when the source argument changes", () => {
    const { result, rerender } = renderHook(
      ({ source }: { source: string }) => useFindReplaceState(source),
      { initialProps: { source: "one two three" } },
    );

    act(() => {
      result.current.setFindQuery("one");
    });
    expect(result.current.findMatchCount).toBe(1);

    rerender({ source: "one two three one one" });
    expect(result.current.findMatchCount).toBe(3);
  });
});
