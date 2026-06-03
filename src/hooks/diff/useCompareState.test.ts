import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { CompareAnchor, CompareCase, CompareViewState } from "../../types";
import { useCompareState } from "./useCompareState";

type ChangesCase = Extract<CompareCase, { kind: "changes" }>;

const sampleAnchor = (path: string): CompareAnchor => ({
  path,
  name: path.split("/").pop() ?? path,
});

const sampleCase = (key: string): ChangesCase => ({
  kind: "changes",
  key,
  scope: "buffer-vs-disk",
  documentPath: `/notes/${key}.md`,
  documentLabel: key,
  leftColumnLabel: "Buffer",
  rightColumnLabel: "Disk",
});

const renamedChangesCase = (key: string, label: string): ChangesCase => ({
  kind: "changes",
  key,
  scope: "buffer-vs-disk",
  documentPath: `/notes/${key}.md`,
  documentLabel: label,
  leftColumnLabel: "Buffer",
  rightColumnLabel: "Disk",
});

const sampleView = (caseKey: string): CompareViewState => ({
  caseKey,
  lines: [],
  additions: 0,
  removals: 0,
});

describe("useCompareState", () => {
  it("starts with no anchor / target / view and an empty case map", () => {
    const { result } = renderHook(() => useCompareState());

    expect(result.current.compareAnchor).toBeNull();
    expect(result.current.compareTarget).toBeNull();
    expect(result.current.compareView).toBeNull();
    expect(result.current.compareCaseByKey).toBeInstanceOf(Map);
    expect(result.current.compareCaseByKey.size).toBe(0);
  });

  it("setters update anchor / target / view independently", () => {
    const { result } = renderHook(() => useCompareState());
    const anchor = sampleAnchor("/notes/left.md");
    const target = sampleAnchor("/notes/right.md");
    const view = sampleView("k");

    act(() => {
      result.current.setCompareAnchor(anchor);
      result.current.setCompareTarget(target);
      result.current.setCompareView(view);
    });

    expect(result.current.compareAnchor).toEqual(anchor);
    expect(result.current.compareTarget).toEqual(target);
    expect(result.current.compareView).toEqual(view);
  });

  it("setCompareCaseEntry stores the entry under its key", () => {
    const { result } = renderHook(() => useCompareState());
    const entry = sampleCase("a");

    act(() => {
      result.current.setCompareCaseEntry(entry);
    });

    expect(result.current.compareCaseByKey.size).toBe(1);
    expect(result.current.compareCaseByKey.get("a")).toEqual(entry);
  });

  it("setCompareCaseEntry overwrites an existing entry with the same key", () => {
    const { result } = renderHook(() => useCompareState());
    const first = sampleCase("a");
    const second = renamedChangesCase("a", "renamed");

    act(() => {
      result.current.setCompareCaseEntry(first);
      result.current.setCompareCaseEntry(second);
    });

    expect(result.current.compareCaseByKey.size).toBe(1);
    expect(
      (result.current.compareCaseByKey.get("a") as ChangesCase | undefined)
        ?.documentLabel,
    ).toBe("renamed");
  });

  it("reuses the same Map instance when re-storing the exact same entry", () => {
    const { result } = renderHook(() => useCompareState());
    const entry = sampleCase("a");

    act(() => {
      result.current.setCompareCaseEntry(entry);
    });
    const mapAfterFirstSet = result.current.compareCaseByKey;

    act(() => {
      result.current.setCompareCaseEntry(entry);
    });
    const mapAfterSecondSet = result.current.compareCaseByKey;

    expect(mapAfterSecondSet).toBe(mapAfterFirstSet);
  });

  it("returns a fresh Map when the stored entry actually changes", () => {
    const { result } = renderHook(() => useCompareState());
    const first = sampleCase("a");
    const second = renamedChangesCase("a", "renamed");

    act(() => {
      result.current.setCompareCaseEntry(first);
    });
    const mapAfterFirstSet = result.current.compareCaseByKey;

    act(() => {
      result.current.setCompareCaseEntry(second);
    });
    const mapAfterSecondSet = result.current.compareCaseByKey;

    expect(mapAfterSecondSet).not.toBe(mapAfterFirstSet);
    expect(
      (mapAfterSecondSet.get("a") as ChangesCase | undefined)?.documentLabel,
    ).toBe("renamed");
  });

  it("getCompareCaseByKey returns the stored entry or undefined", () => {
    const { result } = renderHook(() => useCompareState());
    const entry = sampleCase("a");

    act(() => {
      result.current.setCompareCaseEntry(entry);
    });

    expect(result.current.getCompareCaseByKey("a")).toEqual(entry);
    expect(result.current.getCompareCaseByKey("missing")).toBeUndefined();
  });

  it("getCompareCaseByKey sees the latest entry after an overwrite", () => {
    const { result } = renderHook(() => useCompareState());
    const first = sampleCase("a");
    const second = renamedChangesCase("a", "renamed");

    act(() => {
      result.current.setCompareCaseEntry(first);
    });
    expect(
      (result.current.getCompareCaseByKey("a") as ChangesCase | undefined)
        ?.documentLabel,
    ).toBe("a");

    act(() => {
      result.current.setCompareCaseEntry(second);
    });
    expect(
      (result.current.getCompareCaseByKey("a") as ChangesCase | undefined)
        ?.documentLabel,
    ).toBe("renamed");
  });
});
