import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AppShell, type AppShellProps } from "./AppShell";
vi.mock("./AppTopChrome", () => ({ AppTopChrome: () => <div className="tabs-row"><button>Document tab</button></div> }));
vi.mock("./AppPrimaryToolbar", () => ({ AppPrimaryToolbar: () => null }));
vi.mock("./AppWorkspace", () => ({
  AppWorkspace: ({
    documentChrome,
    onReadingOverlayChange,
  }: {
    documentChrome?: ReactNode;
    onReadingOverlayChange: (open: boolean) => void;
  }) => (
    <section className="workspace">
      <div className="workspace-document-column">
        {documentChrome}
        <input aria-label="Editor" defaultValue="unsaved" />
      </div>
      <button onClick={() => onReadingOverlayChange(true)}>Open Reader</button>
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
