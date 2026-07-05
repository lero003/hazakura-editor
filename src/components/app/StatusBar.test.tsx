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

describe("StatusBar", () => {
  it("keeps detail and format controls in the same trailing row", () => {
    const onConvertEncoding = vi.fn();
    const onConvertLineEnding = vi.fn();
    const { container } = render(
      <StatusBar
        activeTab={activeTab}
        agentLabel={null}
        detail="Markdown / UTF-8 / 10 bytes"
        secondaryDetail=""
        dirtyLabel=""
        encodingAriaLabel="Encoding"
        encodingLabel="Encoding"
        lineEndingAriaLabel="Line endings"
        lineEndingLabel="Line endings"
        lModeEnabled={false}
        onConvertEncoding={onConvertEncoding}
        onConvertLineEnding={onConvertLineEnding}
        saveAffirmation={false}
        saveAffirmationKey={null}
        statusText="Ready"
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
    fireEvent.change(screen.getByRole("combobox", { name: "Encoding" }), {
      target: { value: "shift-jis" },
    });

    expect(onConvertLineEnding).toHaveBeenCalledWith("crlf");
    expect(onConvertEncoding).toHaveBeenCalledWith("shift-jis");

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
        activeTab={activeTab}
        agentLabel={null}
        detail="Markdown · 10 B · 7 characters"
        secondaryDetail="UTF-8 · LF · final newline · Ln 1, Col 1"
        dirtyLabel=""
        encodingAriaLabel="Encoding"
        encodingLabel="Encoding"
        lineEndingAriaLabel="Line endings"
        lineEndingLabel="Line endings"
        lModeEnabled={false}
        onConvertEncoding={vi.fn()}
        onConvertLineEnding={vi.fn()}
        saveAffirmation={false}
        saveAffirmationKey={null}
        statusText="Ready"
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
        activeTab={activeTab}
        agentLabel={null}
        detail="Markdown · 10 B · 7 characters"
        secondaryDetail="UTF-8 · LF · final newline · Ln 1, Col 1"
        dirtyLabel=""
        encodingAriaLabel="Encoding"
        encodingLabel="Encoding"
        lineEndingAriaLabel="Line endings"
        lineEndingLabel="Line endings"
        lModeEnabled={true}
        onConvertEncoding={vi.fn()}
        onConvertLineEnding={vi.fn()}
        saveAffirmation={false}
        saveAffirmationKey={null}
        statusText="Ready"
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
      <StatusBar
        activeTab={activeTab}
        agentLabel={null}
        detail="Markdown / UTF-8 / 10 bytes"
        secondaryDetail=""
        dirtyLabel=""
        encodingAriaLabel="Encoding"
        encodingLabel="Encoding"
        lineEndingAriaLabel="Line endings"
        lineEndingLabel="Line endings"
        lModeEnabled={true}
        onConvertEncoding={vi.fn()}
        onConvertLineEnding={vi.fn()}
        saveAffirmation={false}
        saveAffirmationKey={null}
        statusText="Ready"
      />,
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
      <StatusBar
        activeTab={activeTab}
        agentLabel={null}
        detail="Markdown / UTF-8 / 10 bytes"
        secondaryDetail=""
        dirtyLabel=""
        encodingAriaLabel="Encoding"
        encodingLabel="Encoding"
        lineEndingAriaLabel="Line endings"
        lineEndingLabel="Line endings"
        lModeEnabled={false}
        onConvertEncoding={vi.fn()}
        onConvertLineEnding={vi.fn()}
        saveAffirmation={false}
        saveAffirmationKey={null}
        statusText="Ready"
      />,
    );

    expect(container.querySelector(".status-bar-unsaved-pill")).toBeNull();

    rerender(
      <StatusBar
        activeTab={activeTab}
        agentLabel={null}
        detail="Markdown / UTF-8 / 10 bytes"
        secondaryDetail=""
        dirtyLabel="未保存"
        encodingAriaLabel="Encoding"
        encodingLabel="Encoding"
        lineEndingAriaLabel="Line endings"
        lineEndingLabel="Line endings"
        lModeEnabled={false}
        onConvertEncoding={vi.fn()}
        onConvertLineEnding={vi.fn()}
        saveAffirmation={false}
        saveAffirmationKey={null}
        statusText="Ready"
      />,
    );

    const pill = container.querySelector(".status-bar-unsaved-pill");
    expect(pill?.textContent).toBe("未保存");
  });
});
