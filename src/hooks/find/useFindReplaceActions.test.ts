import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EditorPaneHandle } from "../../components/editor/EditorPane";
import { useFindReplaceActions } from "./useFindReplaceActions";

const matches = [
  { from: 0, to: 3 },
  { from: 4, to: 7 },
  { from: 8, to: 11 },
];

function renderActions(overrides: {
  replaceCurrent?: () => boolean;
  replaceLocked?: boolean;
} = {}) {
  const replaceCurrent = vi.fn(
    overrides.replaceCurrent ?? (() => true as boolean),
  );
  const replaceAll = vi.fn();
  const selectMatchAfter = vi.fn();
  const setActiveMatchIndex = vi.fn();
  const editorPaneRef = {
    current: { replaceCurrent, replaceAll } as unknown as EditorPaneHandle,
  };

  const { result } = renderHook(() =>
    useFindReplaceActions({
      activeMatchIndex: 0,
      editorPaneRef,
      findMatches: matches,
      findMatchCount: matches.length,
      replaceLocked: overrides.replaceLocked ?? false,
      replaceQuery: "bar",
      selectMatchAfter,
      setActiveMatchIndex,
      setFindQuery: vi.fn(),
      setFindVisible: vi.fn(),
      setReplaceQuery: vi.fn(),
      setStatus: vi.fn(),
    }),
  );

  return { replaceAll, replaceCurrent, result, selectMatchAfter, setActiveMatchIndex };
}

describe("useFindReplaceActions", () => {
  it("selects the next match by replacement position instead of incrementing the index", () => {
    const { replaceCurrent, result, selectMatchAfter, setActiveMatchIndex } =
      renderActions();

    act(() => {
      result.current.replaceOne();
    });

    expect(replaceCurrent).toHaveBeenCalledWith("bar");
    // 置換で 0..3 が "bar" になる。次の一致は置換後の位置 3 から選び直す。
    expect(selectMatchAfter).toHaveBeenCalledWith(0 + "bar".length);
    // 番号を機械的に進める方式は使わない（次の一致を飛ばす原因）。
    expect(setActiveMatchIndex).not.toHaveBeenCalled();
  });

  it("does nothing while the replace lock is on", () => {
    const { replaceAll, replaceCurrent, result, selectMatchAfter } =
      renderActions({ replaceLocked: true });

    act(() => {
      result.current.replaceOne();
      result.current.replaceAll();
    });

    expect(replaceCurrent).not.toHaveBeenCalled();
    expect(replaceAll).not.toHaveBeenCalled();
    expect(selectMatchAfter).not.toHaveBeenCalled();
  });

  it("does not advance the index when the editor refused the replacement", () => {
    const { result, selectMatchAfter } = renderActions({
      replaceCurrent: () => false,
    });

    act(() => {
      result.current.replaceOne();
    });

    expect(selectMatchAfter).not.toHaveBeenCalled();
  });
});
