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

it("keeps the editor mounted behind the conflict portal and dismisses only presentation", () => {
  const tab = { id: "doc", sessionId: "conflict", name: "note.md", path: "/note.md", contents: "unsaved" } as NonNullable<AppShellProps["activeTab"]>;
  const dismiss = vi.fn();
  const focus = vi.fn();
  const compare = vi.fn();
  const saveAs = vi.fn(async () => {});
  const props = { ...base, activeTab: tab, menuLanguage: "en" as const, conflictDialogTab: tab,
    dismissConflictDialog: dismiss, focusAfterTransientSurface: focus, reviewTabAgainstDisk: compare, saveConflictAs: saveAs };
  const { container, rerender } = render(<ConnectedShell {...props} />);
  const editor = screen.getByRole("textbox", { name: "Editor", hidden: true });
  expect(container.inert).toBe(true);
  expect(document.activeElement?.textContent).toBe("Return to editor");
  fireEvent.keyDown(window, { key: "Escape", isComposing: true });
  expect(dismiss).not.toHaveBeenCalled();
  fireEvent.keyDown(window, { key: "Escape" });
  expect(dismiss).toHaveBeenCalledOnce();
  expect(compare).not.toHaveBeenCalled();
  expect(saveAs).not.toHaveBeenCalled();
  rerender(<ConnectedShell {...props} conflictDialogTab={null} />);
  expect(container.inert).not.toBe(true);
  expect(screen.getByRole("textbox", { name: "Editor" })).toBe(editor);
  expect((editor as HTMLInputElement).value).toBe("unsaved");
  expect(focus).toHaveBeenCalledOnce();
});

it.each(["Compare changes", "Save As…"])("routes the conflict action %s without destructive callbacks", action => {
  const tab = { id: "doc", sessionId: "conflict", name: "note.md", path: "/note.md" } as NonNullable<AppShellProps["activeTab"]>;
  const compare = vi.fn(); const saveAs = vi.fn(async () => {}); const dismiss = vi.fn();
  render(<ConnectedShell {...base} menuLanguage="en" activeTab={tab} conflictDialogTab={tab}
    reviewTabAgainstDisk={compare} saveConflictAs={saveAs} dismissConflictDialog={dismiss} />);
  fireEvent.click(screen.getByRole("button", { name: action }));
  expect(dismiss).toHaveBeenCalledOnce();
  if (action === "Compare changes") { expect(compare).toHaveBeenCalledWith(tab); expect(saveAs).not.toHaveBeenCalled(); }
  else { expect(saveAs).toHaveBeenCalledOnce(); expect(compare).not.toHaveBeenCalled(); }
});

it("cycles Tab within the conflict surface and ignores IME Escape", () => {
  const tab = { id: "doc", sessionId: "conflict", name: "note.md", path: "/note.md" } as NonNullable<AppShellProps["activeTab"]>;
  render(<ConnectedShell {...base} menuLanguage="en" conflictDialogTab={tab} />);
  const first = screen.getByRole("button", { name: "Return to editor" });
  const last = screen.getByRole("button", { name: "Compare changes" });
  for (const button of screen.getByRole("dialog").querySelectorAll("button")) {
    vi.spyOn(button, "getClientRects").mockReturnValue([{} as DOMRect] as unknown as DOMRectList);
  }
  first.focus(); fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(last);
  fireEvent.keyDown(window, { key: "Tab" });
  expect(document.activeElement).toBe(first);
});
