import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StatusBar } from "./StatusBar";
import type { EditorTab } from "../../types";

afterEach(cleanup);

const activeTab: EditorTab = {
  contents: "# Note\n",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fp",
  ignoredExternalFingerprint: null,
  id: "/workspace/note.md",
  sessionId: "/workspace/note.md",
  large_file_warning: false,
  lastSavedContents: "# Note\n",
  lastSavedEncoding: "utf-8",
  lastSavedLineEnding: "lf",
  line_ending: "lf",
  modified_ms: null,
  name: "note.md",
  path: "/workspace/note.md",
  saveStatus: "idle",
  size: 10,
};

const labels = {
  encodingActionLabel: "Encoding actions",
  encodingActionPlaceholder: "Choose an action",
  encodingChipTitle: "Encoding chip",
  encodingLabel: "Encoding",
  encodingReopenBlocked: "Save or discard unsaved changes first",
  encodingReopenGroup: "Re-read the file as",
  encodingSaveGroup: "Use when saving",
  lineEndingAriaLabel: "Line endings",
  lineEndingLabel: "Line endings",
};

const base = {
  activeDirty: false,
  activeTab,
  agentLabel: null,
  detail: "",
  secondaryDetail: "",
  dirtyLabel: "",
  lModeEnabled: false,
  saveAffirmation: false,
  saveAffirmationKey: null,
  statusText: "Ready",
  ...labels,
  onConvertEncoding: () => {},
  onConvertLineEnding: () => {},
};

describe("StatusBar", () => {
  it("keeps explicit re-decoding separate from save encoding in one chip", () => {
    const reopen = vi.fn();
    const convert = vi.fn();
    const { container } = render(
      <StatusBar {...base} onConvertEncoding={convert} onReopenEncoding={reopen} />,
    );

    // 1チップに2群（読み直す / 保存時に使う）を入れ、操作を value の接頭辞で分ける。
    const group = container.querySelector(".status-bar-format-group");
    expect(group?.querySelectorAll(".status-bar-format-chip")).toHaveLength(2);
    const encodingSelect = screen.getByRole("combobox", {
      name: "Encoding actions",
    }) as HTMLSelectElement;
    const optionValues = Array.from(encodingSelect.querySelectorAll("option")).map(
      (option) => option.value,
    );
    // 先頭は中立（まだ何も選んでいない）。そのあとに読み直す群 → 保存する群の順。
    expect(optionValues).toEqual([
      "",
      "reopen:utf-8",
      "reopen:utf-8-bom",
      "reopen:shift-jis",
      "reopen:euc-jp",
      "save:utf-8",
      "save:utf-8-bom",
      "save:shift-jis",
      "save:euc-jp",
    ]);

    // この select は「これから行う操作」を選ぶ面なので、**selected は常に中立**。
    // 以前は selected を `save:<現在の文字コード>` にしていたため、ネイティブの select や
    // キーボード/VoiceOver では「保存する文字コードを変える」が選択中に見え、
    // 安全側（読み直す）を先頭に置いた狙いが実質的に弱まっていた。
    expect(encodingSelect.value).toBe("");

    fireEvent.change(encodingSelect, { target: { value: "reopen:euc-jp" } });
    expect(reopen).toHaveBeenCalledWith("euc-jp");
    expect(convert).not.toHaveBeenCalled();
    // 操作のあとは中立へ戻る（直前に選んだ操作が選択中として残らない）。
    expect(encodingSelect.value).toBe("");

    fireEvent.change(encodingSelect, { target: { value: "save:shift-jis" } });
    expect(convert).toHaveBeenCalledWith("shift-jis");
    expect(encodingSelect.value).toBe("");
  });

  it("blocks the re-read group while the buffer has unsaved edits", () => {
    const { container } = render(
      <StatusBar {...base} activeDirty onReopenEncoding={vi.fn()} />,
    );

    const reopenOptions = Array.from(
      container.querySelectorAll('option[value^="reopen:"]'),
    );
    expect(reopenOptions).toHaveLength(4);
    expect(reopenOptions.every((option) => option.hasAttribute("disabled"))).toBe(true);
    // 押せない理由はチップの title に出す（disabled な option の title は読めない）。
    const chip = container.querySelector(".status-bar-format-chip[title]");
    expect(chip?.getAttribute("title")).toContain("Save or discard unsaved changes first");
  });

  it("does not offer re-reading a pathless draft from disk", () => {
    render(
      <StatusBar
        {...base}
        activeTab={{ ...activeTab, id: "draft:1", sessionId: "draft:1", path: "" }}
        onReopenEncoding={vi.fn()}
      />,
    );

    const encodingSelect = screen.getByRole("combobox", {
      name: "Encoding actions",
    }) as HTMLSelectElement;
    expect(encodingSelect.querySelectorAll('option[value^="reopen:"]')).toHaveLength(0);
    expect(encodingSelect.querySelectorAll('option[value^="save:"]')).toHaveLength(4);
    // パスが無いときは読み直す群そのものが無い＝中立＋保存する群だけ。
    expect(encodingSelect.value).toBe("");
  });

  it("keeps detail and format controls in the same trailing row", () => {
    const onConvertEncoding = vi.fn();
    const onConvertLineEnding = vi.fn();
    const { container } = render(
      <StatusBar
        {...base}
        detail="Markdown / UTF-8 / 10 bytes"
        onConvertEncoding={onConvertEncoding}
        onConvertLineEnding={onConvertLineEnding}
      />,
    );

    const statusBar = container.querySelector(".status-bar");
    const formatGroup = container.querySelector(".status-bar-format-group");
    const detail = container.querySelector(".status-bar-detail");

    expect(statusBar?.lastElementChild).toBe(formatGroup);
    expect(detail?.parentElement).toBe(formatGroup);
    expect(formatGroup?.querySelectorAll("select")).toHaveLength(2);
    expect(detail?.getAttribute("title")).toBe("Markdown / UTF-8 / 10 bytes");

    fireEvent.change(screen.getByRole("combobox", { name: "Line endings" }), {
      target: { value: "crlf" },
    });

    expect(onConvertLineEnding).toHaveBeenCalledWith("crlf");

    // The status text must be exposed as a live region so
    // screen readers announce status changes (e.g. "Saved",
    // "Close stopped", "External change detected").
    // getByRole("status") で取得できれば role="status" の存在自体が検証できる。
    // クラス名 (.status-bar-status) に依存しないため、リファクタでクラス名が
    // 変わってもライブリージョン契約は保たれる。
    const statusSegment = screen.getByRole("status");
    expect(statusSegment.getAttribute("aria-live")).toBe("polite");
  });

  it("shortens the passive detail in normal mode while keeping the full title", () => {
    const { container } = render(
      <StatusBar
        {...base}
        detail="Markdown · 10 B · 7 characters"
        secondaryDetail="UTF-8 · LF · final newline · Ln 1, Col 1"
      />,
    );

    const detail = container.querySelector(".status-bar-detail");
    const formatGroup = container.querySelector(".status-bar-format-group");
    const visualValues = Array.from(
      container.querySelectorAll(".status-bar-format-value"),
    );

    expect(formatGroup?.querySelector("select")?.textContent).toContain("LF");
    expect(formatGroup?.textContent).toContain("UTF-8");
    expect(visualValues.map((value) => value.textContent)).toEqual([
      "LF",
      "UTF-8",
    ]);
    expect(
      visualValues.every(
        (value) => value.getAttribute("aria-hidden") === "true",
      ),
    ).toBe(true);
    expect(detail?.textContent).toBe("Markdown · 10 B · 7 characters");
    expect(detail?.getAttribute("title")).toBe(
      "Markdown · 10 B · 7 characters · UTF-8 · LF · final newline · Ln 1, Col 1",
    );
  });

  it("shows the full detail in L Mode because format controls are hidden", () => {
    const { container } = render(
      <StatusBar
        {...base}
        detail="Markdown · 10 B · 7 characters"
        lModeEnabled
        secondaryDetail="UTF-8 · LF · final newline · Ln 1, Col 1"
      />,
    );

    const detail = container.querySelector(".status-bar-detail");

    expect(container.querySelector(".status-bar-format-group")).toBeNull();
    expect(detail?.textContent).toBe(
      "Markdown · 10 B · 7 characters · UTF-8 · LF · final newline · Ln 1, Col 1",
    );
  });

  it("removes focusable format controls in L Mode", () => {
    const { container } = render(
      <StatusBar {...base} detail="Markdown / UTF-8 / 10 bytes" lModeEnabled />,
    );

    expect(container.querySelector(".status-bar-format-group")).toBeNull();
    expect(container.querySelector(".l-mode-action-rail")).toBeNull();
    expect(container.querySelectorAll("select")).toHaveLength(0);

    // `role="status"` must be present even in L Mode —
    // status messages (dirty, save, conflict) still need
    // to be surfaced to assistive technology.
    const statusSegment = screen.getByRole("status");
    expect(statusSegment.getAttribute("aria-live")).toBe("polite");
  });

  it("renders the unsaved pill when dirtyLabel is provided", () => {
    const { container, rerender } = render(
      <StatusBar {...base} detail="Markdown / UTF-8 / 10 bytes" />,
    );

    expect(container.querySelector(".status-bar-unsaved-pill")).toBeNull();

    rerender(
      <StatusBar {...base} detail="Markdown / UTF-8 / 10 bytes" dirtyLabel="未保存" />,
    );

    const pill = container.querySelector(".status-bar-unsaved-pill");
    expect(pill?.textContent).toBe("未保存");
  });
});
