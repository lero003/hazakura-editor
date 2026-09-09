import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AppShell, type AppShellProps } from "./AppShell";
vi.mock("./AppTopChrome", () => ({ AppTopChrome: () => <div className="tabs-row"><button>Document tab</button></div> }));
vi.mock("./AppPrimaryToolbar", () => ({
  AppPrimaryToolbar: ({ navigation }: { navigation: { onWrite: () => void } }) =>
    <button onClick={navigation.onWrite}>Write</button>,
}));
vi.mock("./AppWorkspace", () => ({
  AppWorkspace: ({
    documentChrome,
    onReadingOverlayChange,
    compactPreviewFocus,
    onCompactPreviewFocusChange,
  }: {
    documentChrome?: ReactNode;
    compactPreviewFocus: "editor" | "preview";
    onCompactPreviewFocusChange: (focus: "editor" | "preview") => void;
    onReadingOverlayChange: (open: boolean) => void;
  }) => (
    <section className="workspace" data-compact-preview={compactPreviewFocus}>
      <div className="workspace-document-column">
        {documentChrome}
        <input aria-label="Editor" defaultValue="unsaved" />
      </div>
      <button onClick={() => onReadingOverlayChange(true)}>Open Reader</button>
      <button onClick={() => onCompactPreviewFocusChange("preview")}>Compact Preview</button>
    </section>
  ),
}));
vi.mock("./AppDocumentFeedback", () => ({AppDocumentFeedback: () => null}));
vi.mock("./AppStatusBar", () => ({AppStatusBar: () => null}));
vi.mock("./AppOverlays", () => ({AppOverlays: () => null}));
vi.mock("./LModeActionRail", () => ({LModeActionRail: () => null}));
vi.mock("./LModeExitPill", () => ({LModeExitPill: () => null}));
vi.mock("./LocalAssistProposalReview", () => ({LocalAssistProposalReview: () => null}));
vi.mock("../../hooks/editor/useLocalAssistProposal", () => ({useLocalAssistProposal: () => ({proposal: null})}));

afterEach(cleanup);

const base = {
  tabs: [],
  workspaceRootPath: null,
  resolvedTheme: "light",
  activeTab: null,
  editorSettings: {},
  lModeEnabled: false,
} as unknown as AppShellProps;

describe("AppShell chrome layers", () => {
  it("reveals the editor from compact Preview through the primary Write action", () => {
    const hideSidePane = vi.fn();
    const { container } = render(<AppShell {...base}
      activeTab={{ name: "draft.md", path: "", sessionId: "draft" } as AppShellProps["activeTab"]}
      sidePaneMode="preview" hideSidePane={hideSidePane}
      editorPaneRef={{ current: null }} />);
    const editor = screen.getByRole("textbox", { name: "Editor" });
    fireEvent.click(screen.getByRole("button", { name: "Compact Preview" }));
    expect(container.querySelector("[data-compact-preview='preview']")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Write" }));
    expect(container.querySelector("[data-compact-preview='editor']")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Editor" })).toBe(editor);
    expect(hideSidePane).not.toHaveBeenCalled();
  });

  it("keeps floating L Mode tabs outside the workspace stacking context while retaining the editor", () => {
    const view = render(<AppShell {...base} />);
    const editor = screen.getByRole("textbox", {name: "Editor"});
    expect(screen.getByRole("button", {name: "Document tab"}).closest(".workspace")).toBeTruthy();
    view.rerender(<AppShell {...base} lModeEnabled />);
    const chrome = screen.getByRole("button", {name: "Document tab"}).closest(".tabs-row")!;
    expect(chrome.parentElement).toBe(view.container.querySelector(".app-shell"));
    expect(chrome.parentElement).toBe(view.container.querySelector(".lmode-window-drag-band")?.parentElement);
    expect(screen.getByRole("textbox", {name: "Editor"})).toBe(editor);
    view.rerender(<AppShell {...base} />);
    expect(screen.getByRole("textbox", {name: "Editor"})).toBe(editor);
  });
  it("does not leave floated L Mode tabs above an independent Reader", () => {
    render(<AppShell {...base} lModeEnabled />);
    fireEvent.click(screen.getByRole("button", {name: "Open Reader"}));
    expect(screen.queryByRole("button", {name: "Document tab"})).toBeNull();
  });
});
