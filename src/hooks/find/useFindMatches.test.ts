import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import type { SearchOptions } from "../../types";
import { useFindMatches } from "./useFindMatches";

const baseOptions: SearchOptions = {
  caseSensitive: false,
  wholeWord: false,
  regex: false,
};

describe("useFindMatches", () => {
  it("returns no matches and no invalidRegex for an empty query", () => {
    const { result } = renderHook(() =>
      useFindMatches({ options: baseOptions, query: "", source: "anything" }),
    );

    expect(result.current.findMatches).toEqual([]);
    expect(result.current.invalidRegex).toBe(false);
  });

  it("returns no matches for a whitespace-only query", () => {
    const { result } = renderHook(() =>
      useFindMatches({
        options: baseOptions,
        query: "   ",
        source: "anything",
      }),
    );

    expect(result.current.findMatches).toEqual([]);
    expect(result.current.invalidRegex).toBe(false);
  });

  it("does not flag invalidRegex when regex is off even if the pattern would not compile", () => {
    const { result } = renderHook(() =>
      useFindMatches({
        options: baseOptions,
        query: "(unclosed",
        source: "anything",
      }),
    );

    expect(result.current.invalidRegex).toBe(false);
    expect(result.current.findMatches).toEqual([]);
  });

  it("returns regex matches for a valid pattern with regex option on", () => {
    const source = "foo123 bar456 baz789";
    const { result } = renderHook(() =>
      useFindMatches({
        options: { ...baseOptions, regex: true },
        query: "\\d+",
        source,
      }),
    );

    expect(result.current.findMatches.map((m) => m.from)).toEqual([3, 10, 17]);
    expect(result.current.invalidRegex).toBe(false);
  });

  it("sets invalidRegex and returns no matches for a malformed regex pattern", () => {
    const { result } = renderHook(() =>
      useFindMatches({
        options: { ...baseOptions, regex: true },
        query: "(unclosed",
        source: "anything",
      }),
    );

    expect(result.current.invalidRegex).toBe(true);
    expect(result.current.findMatches).toEqual([]);
  });

  it("does not flag invalidRegex when regex is on but query is empty", () => {
    const { result } = renderHook(() =>
      useFindMatches({
        options: { ...baseOptions, regex: true },
        query: "",
        source: "anything",
      }),
    );

    expect(result.current.invalidRegex).toBe(false);
    expect(result.current.findMatches).toEqual([]);
  });

  it("does not flag invalidRegex when regex is on and the query is whitespace only", () => {
    const { result } = renderHook(() =>
      useFindMatches({
        options: { ...baseOptions, regex: true },
        query: "   ",
        source: "anything",
      }),
    );

    expect(result.current.invalidRegex).toBe(false);
    expect(result.current.findMatches).toEqual([]);
  });

  it("caps plain matches at 999 even when more exist", () => {
    const source = "x".repeat(1500);
    const { result } = renderHook(() =>
      useFindMatches({ options: baseOptions, query: "x", source }),
    );

    expect(result.current.findMatches.length).toBe(999);
  });

  it("caps regex matches at 999 even when more exist", () => {
    const source = "x".repeat(1500);
    const { result } = renderHook(() =>
      useFindMatches({
        options: { ...baseOptions, regex: true },
        query: "x",
        source,
      }),
    );

    expect(result.current.findMatches.length).toBe(999);
  });

  it("recomputes matches when the source argument changes", () => {
    const { result, rerender } = renderHook(
      ({ source }: { source: string }) =>
        useFindMatches({ options: baseOptions, query: "cat", source }),
      { initialProps: { source: "cat and dog" } },
    );

    expect(result.current.findMatches.map((m) => m.from)).toEqual([0]);

    rerender({ source: "cat and dog cat" });
    expect(result.current.findMatches.map((m) => m.from)).toEqual([0, 12]);
  });

  it("recomputes matches when the query argument changes", () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) =>
        useFindMatches({ options: baseOptions, query, source: "abc abc abc" }),
      { initialProps: { query: "abc" } },
    );

    expect(result.current.findMatches.length).toBe(3);

    rerender({ query: "abcd" });
    expect(result.current.findMatches).toEqual([]);
  });

  it("recomputes matches when the options argument changes", () => {
    const { result, rerender } = renderHook(
      ({ options }: { options: SearchOptions }) =>
        useFindMatches({ options, query: "cat", source: "Cat cat" }),
      { initialProps: { options: baseOptions } },
    );

    expect(result.current.findMatches.length).toBe(2);

    rerender({ options: { ...baseOptions, caseSensitive: true } });
    expect(result.current.findMatches.map((m) => m.from)).toEqual([4]);
  });
});
