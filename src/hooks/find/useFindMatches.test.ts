import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { SearchOptions } from "../../types";
import { advanceStringIndex, useFindMatches } from "./useFindMatches";

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

  // N1: 空一致を UTF-16 の 1 単位で進めると、絵文字（サロゲートペア）の途中へ
  // 入り、次の exec が同じ位置の空一致へ戻って無限ループになる。
  it("terminates for zero-width regex patterns around astral characters", () => {
    const cases: Array<[string, string]> = [
      ["😀", "^"],
      ["😀", "(?=.)"],
      ["A😀B", "(?=.)"],
      ["🙂あ🙂", "(?=.)"],
      ["𩸽", "^"],
    ];

    for (const [source, query] of cases) {
      const { result } = renderHook(() =>
        useFindMatches({
          options: { ...baseOptions, regex: true },
          query,
          source,
        }),
      );

      // 空一致は採用しないので結果は空。ここに戻ってくることが目的（旧実装は停止しない）。
      expect(result.current.findMatches).toEqual([]);
    }
  });

  it("keeps regex offsets in the original text after astral characters", () => {
    const { result } = renderHook(() =>
      useFindMatches({
        options: { ...baseOptions, regex: true },
        query: "foo",
        source: "😀foo",
      }),
    );

    expect(result.current.findMatches).toEqual([{ from: 2, to: 5 }]);
  });

  it("finds the match after a zero-width hit at an astral boundary", () => {
    // 空一致の前進が 1 単位だと、位置 1 から u フラグで 0 へ戻され、
    // 位置 2 の "foo" に到達できない（反復上限で打ち切られて空になる）。
    const { result } = renderHook(() =>
      useFindMatches({
        options: { ...baseOptions, regex: true },
        query: "^|foo",
        source: "😀foo",
      }),
    );

    expect(result.current.findMatches).toEqual([{ from: 2, to: 5 }]);
  });

  // N2: 小文字化で長さが変わる文字（İ U+0130 → "i" + U+0307）より後ろの一致でも、
  // 原文の座標を返す。旧実装は置換範囲がずれ、末尾では本文長を超える範囲も返した。
  it("returns original-text offsets for case-insensitive matches after İ", () => {
    const { result } = renderHook(() =>
      useFindMatches({
        options: baseOptions,
        query: "foo",
        source: "İ foo Z",
      }),
    );

    expect(result.current.findMatches).toEqual([{ from: 2, to: 5 }]);
  });

  it("never returns offsets beyond the source when a prefix expands on lowercasing", () => {
    const source = "İabc";
    const { result } = renderHook(() =>
      useFindMatches({ options: baseOptions, query: "abc", source }),
    );

    expect(result.current.findMatches).toEqual([{ from: 1, to: 4 }]);
    for (const match of result.current.findMatches) {
      expect(match.to).toBeLessThanOrEqual(source.length);
    }
  });

  it("still matches case-insensitively for plain ASCII queries", () => {
    const { result } = renderHook(() =>
      useFindMatches({
        options: baseOptions,
        query: "hello",
        source: "Hello hello HELLO",
      }),
    );

    expect(result.current.findMatches.map((match) => match.from)).toEqual([
      0, 6, 12,
    ]);
  });

  // N4: 前後の文字を UTF-16 の 1 単位で取ると、補助面の漢字・数字が
  // 「単語文字でない」と判定され、単語全体ではない箇所まで一致になる。
  it("treats astral letters and digits as word characters for whole-word search", () => {
    const cases: Array<[string, number]> = [
      // 直前が補助面の漢字（𠮷 U+20BB7）
      ["吉田", 0],
      ["𠮷田", 0],
      // 直後が補助面の漢字
      ["田𠮷", 0],
      // 絵文字は単語文字ではないので境界になる
      ["😀田", 1],
      ["🙂田🙂", 1],
      // 補助面の数字（𝟙 U+1D7D9）も単語文字
      ["𝟙田", 0],
      // 空白で囲まれた通常の一致は対照
      [" 田 ", 1],
    ];

    for (const [source, expected] of cases) {
      const { result } = renderHook(() =>
        useFindMatches({
          options: { ...baseOptions, wholeWord: true },
          query: "田",
          source,
        }),
      );

      expect([source, result.current.findMatches.length]).toEqual([
        source,
        expected,
      ]);
    }
  });

  it("applies the same code-point boundaries to regex search", () => {
    const { result } = renderHook(() =>
      useFindMatches({
        options: { ...baseOptions, regex: true, wholeWord: true },
        query: "田",
        source: "𠮷田",
      }),
    );

    expect(result.current.findMatches).toEqual([]);
  });

  // N3: 999 件そろった後に 1000 回目の照合をしない（条件式の順序）。
  it("does not attempt another regex match once 999 matches are collected", () => {
    const execSpy = vi.spyOn(RegExp.prototype, "exec");
    const source = "x".repeat(1500);

    try {
      const { result } = renderHook(() =>
        useFindMatches({
          options: { ...baseOptions, regex: true },
          query: "x",
          source,
        }),
      );

      expect(result.current.findMatches).toHaveLength(999);
      expect(
        execSpy.mock.calls.filter(([value]) => value === source).length,
      ).toBe(999);
    } finally {
      execSpy.mockRestore();
    }
  });

  it("does not attempt another literal match once 999 matches are collected", () => {
    const execSpy = vi.spyOn(RegExp.prototype, "exec");
    const source = "x".repeat(1500);

    try {
      const { result } = renderHook(() =>
        useFindMatches({ options: baseOptions, query: "x", source }),
      );

      expect(result.current.findMatches).toHaveLength(999);
      expect(
        execSpy.mock.calls.filter(([value]) => value === source).length,
      ).toBe(999);
    } finally {
      execSpy.mockRestore();
    }
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

describe("advanceStringIndex", () => {
  it("advances surrogate pairs by two UTF-16 units", () => {
    expect(advanceStringIndex("😀", 0)).toBe(2);
    expect(advanceStringIndex("a😀b", 1)).toBe(3);
    expect(advanceStringIndex("abc", 0)).toBe(1);
    // 末尾（および範囲外）は 1 つ進めて exec を終わらせる。
    expect(advanceStringIndex("ab", 2)).toBe(3);
  });
});
