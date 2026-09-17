import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import { useFindReplaceController } from "./useFindReplaceController";

// R4 の回帰は state hook 単体では足りない。controller では
// `useFindReplaceState` の位置ベース選択と `useFindMatchIndexSync` の
// 件数による丸めが同じ render で走るため、実際の組み合わせで固定する。
function setupController(initialSource: string) {
  const replaceCurrent = vi.fn(() => true);
  const replaceAll = vi.fn();
  const editorPaneRef = {
    current: { replaceAll, replaceCurrent } as unknown as EditorPaneHandle,
  };
  const setStatus = vi.fn();
  const { result, rerender } = renderHook(
    ({ source }: { source: string }) =>
      useFindReplaceController({
        documentKey: "doc",
        editorPaneRef,
        setStatus,
        source,
      }),
    { initialProps: { source: initialSource } },
  );

  return {
    result,
    setQuery(query: string) {
      act(() => {
        result.current.setFindQuery(query);
      });
    },
    selectIndex(index: number) {
      act(() => {
        result.current.setActiveMatchIndex(index);
      });
    },
    replaceOneWith(nextSource: string, replacement: string) {
      act(() => {
        result.current.setReplaceQuery(replacement);
      });
      act(() => {
        result.current.replaceOne();
      });
      act(() => {
        rerender({ source: nextSource });
      });
    },
  };
}

describe("useFindReplaceController — 1件置換の次一致", () => {
  it("wraps to the first match when the last of three matches is replaced", () => {
    const harness = setupController("foo foo foo");
    harness.setQuery("foo");
    harness.selectIndex(2);

    harness.replaceOneWith("foo foo bar", "bar");

    // 残る一致は先頭と中央。末尾の次は無いので先頭へ戻る。
    // 件数による丸め（古い index 2 / 新しい件数 2 → 1）に上書きされない。
    expect(harness.result.current.findMatches.map((match) => match.from)).toEqual([
      0, 4,
    ]);
    expect(harness.result.current.activeMatchIndex).toBe(0);
  });

  it("advances when the replacement text is identical (source unchanged)", () => {
    const harness = setupController("foo foo foo");
    harness.setQuery("foo");
    harness.selectIndex(0);

    // 同じ語への置換では source も一致一覧も変わらない。
    harness.replaceOneWith("foo foo foo", "foo");

    expect(harness.result.current.activeMatchIndex).toBe(1);
  });

  it("skips matches inside the replacement text", () => {
    const harness = setupController("foo foo");
    harness.setQuery("foo");
    harness.selectIndex(0);

    harness.replaceOneWith("foofoo foo", "foofoo");

    // 置換結果の中の一致（位置 0 / 3）に留まらず、置換の後ろ（位置 7）へ進む。
    expect(harness.result.current.activeMatchIndex).toBe(2);
  });

  it("keeps index 0 when every match disappears", () => {
    const harness = setupController("foo");
    harness.setQuery("foo");
    harness.selectIndex(0);

    harness.replaceOneWith("bar", "bar");

    expect(harness.result.current.findMatchCount).toBe(0);
    expect(harness.result.current.activeMatchIndex).toBe(0);
  });

  it("advances only one match per replace", () => {
    const harness = setupController("foo foo foo foo");
    harness.setQuery("foo");
    harness.selectIndex(0);

    harness.replaceOneWith("bar foo foo foo", "bar");

    expect(harness.result.current.activeMatchIndex).toBe(0);
    expect(
      harness.result.current.findMatches[harness.result.current.activeMatchIndex],
    ).toEqual({ from: 4, to: 7 });
  });
});
