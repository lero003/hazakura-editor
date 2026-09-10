import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EditorTab } from "../../types";
import { getFileMetadata } from "../../lib/tauri/files";
import { SaveConflictDialog, saveConflictCopy } from "./SaveConflictDialog";

vi.mock("../../lib/tauri/files", () => ({ getFileMetadata: vi.fn() }));

const runtimeWindow = window as Window & { __TAURI_INTERNALS__?: unknown };

function makeTab(overrides: Partial<EditorTab> = {}): EditorTab {
  return {
    contents: "あ".repeat(1268),
    encoding: "utf-8",
    error: null,
    externalFingerprint: "fp-external",
    fingerprint: "fp-disk",
    id: "/workspace/02_朝の余白.md",
    sessionId: "session:1",
    ignoredExternalFingerprint: null,
    large_file_warning: false,
    lastSavedContents: "あ".repeat(1200),
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    modified_ms: null,
    name: "02_朝の余白.md",
    path: "/workspace/02_朝の余白.md",
    saveStatus: "conflict",
    size: 1200,
    ...overrides,
  };
}

function renderDialog(overrides: Partial<EditorTab> = {}) {
  const onBack = vi.fn();
  const onCompare = vi.fn();
  const onSaveAs = vi.fn();
  render(
    <SaveConflictDialog
      tab={makeTab(overrides)}
      menuLanguage="ja"
      onBack={onBack}
      onCompare={onCompare}
      onSaveAs={onSaveAs}
    />,
  );
  return { onBack, onCompare, onSaveAs };
}

describe("SaveConflictDialog", () => {
  beforeEach(() => {
    // 既定は「読めない」: スタブしていない読み取りが undefined を返して
    // フックの .then が落ちないようにする（実機では起きない形）。
    vi.mocked(getFileMetadata).mockReset().mockRejectedValue(new Error("metadata not stubbed"));
    runtimeWindow.__TAURI_INTERNALS__ = {};
  });

  afterEach(() => {
    cleanup();
    delete runtimeWindow.__TAURI_INTERNALS__;
  });

  it("shows the two versions as peers with real numbers only", async () => {
    vi.mocked(getFileMetadata).mockResolvedValue({
      path: "/workspace/02_朝の余白.md",
      size: 4173,
      modified_ms: new Date(2026, 8, 11, 12, 41).getTime(),
      fingerprint: "fp-disk",
      large_file_warning: false,
    });

    renderDialog();

    expect(screen.getByText("このウィンドウの編集")).toBeTruthy();
    expect(screen.getByText("ディスク上のファイル")).toBeTruthy();
    // 手元の文字数はバッファから実データで出す（桁区切りはロケール非依存）。
    expect(screen.getByText("1,268 文字 · 手元の変更")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByText("4.1 KB · 最終更新 2026/09/11 12:41 · 別の変更")).toBeTruthy(),
    );
    // 実データが無い側は数字を捏造しない。
    expect(screen.queryByText(/1,312/)).toBeNull();
  });

  it("shows only the label when the disk side cannot be read", async () => {
    vi.mocked(getFileMetadata).mockRejectedValue(new Error("unreadable"));

    renderDialog();

    await waitFor(() => expect(getFileMetadata).toHaveBeenCalledTimes(1));
    expect(screen.getByText("別の変更")).toBeTruthy();
    expect(screen.queryByText(/最終更新/)).toBeNull();
  });

  it("keeps the compare action primary and the destructive paths secondary", () => {
    const { onBack, onCompare, onSaveAs } = renderDialog();

    const compare = screen.getByRole("button", { name: "差分を確認" });
    expect(compare.className).toContain("save-conflict-primary");
    expect(screen.getByRole("button", { name: "編集へ戻る" }).className).not.toContain(
      "save-conflict-primary",
    );
    expect(screen.getByRole("button", { name: "別名で保存…" }).className).not.toContain(
      "save-conflict-primary",
    );

    fireEvent.click(compare);
    fireEvent.click(screen.getByRole("button", { name: "別名で保存…" }));
    fireEvent.click(screen.getByRole("button", { name: "編集へ戻る" }));

    expect(onCompare).toHaveBeenCalledTimes(1);
    expect(onSaveAs).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("states that nothing has been overwritten yet", () => {
    renderDialog();

    expect(
      screen.getByText(/この段階では、どちらの内容も上書きしていません。/),
    ).toBeTruthy();
  });

  it("focuses the safe action and closes on Escape without resolving the conflict", () => {
    const { onBack } = renderDialog();

    const back = screen.getByRole("button", { name: "編集へ戻る" });
    expect(document.activeElement).toBe(back);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("keeps every language copy wired to the same structure", () => {
    for (const language of ["ja", "en", "kana"] as const) {
      const copy = saveConflictCopy(language);
      expect(copy.bufferMeta("1,268")).toContain("1,268");
      expect(copy.diskMeta("4.1 KB", "2026/09/11 12:41")).toContain("4.1 KB");
      expect(copy.diskMetaFallback.length).toBeGreaterThan(0);
      expect(copy.title.length).toBeGreaterThan(0);
    }
  });
});
