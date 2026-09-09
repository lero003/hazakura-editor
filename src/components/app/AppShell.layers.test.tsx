import { usePreviewSurface } from "../../hooks/editor/usePreviewSurface";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AppShell, type AppShellProps } from "./AppShell";
vi.mock("./AppTopChrome", () => ({
  AppTopChrome: ({ onTogglePreview }: { onTogglePreview: () => void }) =>
    <div className="tabs-row"><button>Document tab</button><button onClick={onTogglePreview}>Toggle Preview</button></div>,
}));
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
vi.mock("./LocalAssistProposalReview", () => ({LocalAssistProposalReview: ({blocked}: {blocked: boolean}) => <div data-testid="proposal-lock" data-blocked={blocked} />}));
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

function ConnectedShell(props: AppShellProps) {
  const surface = usePreviewSurface({ sidePaneMode: props.sidePaneMode,
    togglePreviewPane: props.onTogglePreview ?? (() => {}), leaveReference: () => {} });
  return <AppShell {...props} compactPreviewFocus={surface.compactPreviewFocus}
    onCompactPreviewFocusChange={surface.setCompactPreviewFocus} onTogglePreview={surface.togglePreviewSurface} />;
}

describe("AppShell chrome layers", () => {
  it("passes the generation or cancellation lock into proposal review", () => {
    render(<ConnectedShell {...base} appleAssistGenerationLock={{ requestId: "pending" } as AppShellProps["appleAssistGenerationLock"]} />);
    expect(screen.getByTestId("proposal-lock").getAttribute("data-blocked")).toBe("true");
  });

  it.each([null, "ebook"] as const)("selects Preview through the existing chrome entry from %s", (sidePaneMode) => {
    const onTogglePreview = vi.fn();
    const { container } = render(<ConnectedShell {...base} sidePaneMode={sidePaneMode} onTogglePreview={onTogglePreview} />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle Preview" }));
    expect(container.querySelector("[data-compact-preview='preview']")).toBeTruthy();
    expect(onTogglePreview).toHaveBeenCalledOnce();
  });
  it("keeps the existing close action when Preview is already open", () => {
    const onTogglePreview = vi.fn();
    const { container } = render(<ConnectedShell {...base} sidePaneMode="preview" onTogglePreview={onTogglePreview} />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle Preview" }));
    expect(container.querySelector("[data-compact-preview='editor']")).toBeTruthy();
    expect(onTogglePreview).toHaveBeenCalledOnce();
  });

  it("reveals the editor from compact Preview through the primary Write action", () => {
    const hideSidePane = vi.fn();
    const { container } = render(<ConnectedShell {...base}
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
    const view = render(<ConnectedShell {...base} />);
    const editor = screen.getByRole("textbox", {name: "Editor"});
    expect(screen.getByRole("button", {name: "Document tab"}).closest(".workspace")).toBeTruthy();
    view.rerender(<ConnectedShell {...base} lModeEnabled />);
    const chrome = screen.getByRole("button", {name: "Document tab"}).closest(".tabs-row")!;
    expect(chrome.parentElement).toBe(view.container.querySelector(".app-shell"));
    expect(chrome.parentElement).toBe(view.container.querySelector(".lmode-window-drag-band")?.parentElement);
    expect(screen.getByRole("textbox", {name: "Editor"})).toBe(editor);
    view.rerender(<ConnectedShell {...base} />);
    expect(screen.getByRole("textbox", {name: "Editor"})).toBe(editor);
  });
  it("does not leave floated L Mode tabs above an independent Reader", () => {
    render(<ConnectedShell {...base} lModeEnabled />);
    fireEvent.click(screen.getByRole("button", {name: "Open Reader"}));
    expect(screen.queryByRole("button", {name: "Document tab"})).toBeNull();
  });
});
