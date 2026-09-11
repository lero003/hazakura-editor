import { usePreviewSurface } from "../../hooks/editor/usePreviewSurface";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { AppShell, type AppShellProps } from "./AppShell";
vi.mock("./AppTopChrome", () => ({
  AppTopChrome: ({ onTogglePreview, navigation }: { onTogglePreview: () => void; navigation: { onReview: (target: string) => void } }) =>
    <div className="tabs-row">
      <button>Document tab</button>
      <button onClick={onTogglePreview}>Toggle Preview</button>
    </div>,
}));
vi.mock("./AppPrimaryToolbar", () => ({
  AppPrimaryToolbar: ({ navigation }: { navigation: { mode: string; onWrite: () => void; onReview: (target: string) => void } }) =>
    <div data-mode={navigation.mode}>
      <button onClick={navigation.onWrite}>Write</button>
      {/* 上部ナビの「確認 → 提案」。実ナビと同じく navigation.onReview を通す。 */}
      <button onClick={() => navigation.onReview("proposal")}>Check proposal</button>
    </div>,
}));
vi.mock("./AppWorkspace", () => ({
  AppWorkspace: ({
    appleAssistGenerationLock,
    documentChrome,
    onReadingOverlayChange,
    compactPreviewFocus,
    onCompactPreviewFocusChange,
    onReturnToEditing,
    proposalReviewRef,
    proposalReviewVisible,
  }: {
    appleAssistGenerationLock?: { requestId: string } | null;
    proposalReviewVisible?: boolean;
    documentChrome?: ReactNode;
    compactPreviewFocus: "editor" | "preview";
    onCompactPreviewFocusChange: (focus: "editor" | "preview") => void;
    onReturnToEditing?: () => void;
    proposalReviewRef?: { current: HTMLDivElement | null };
    onReadingOverlayChange: (open: boolean) => void;
  }) => (
    <section
      className="workspace"
      data-compact-preview={compactPreviewFocus}
      data-generation-lock={appleAssistGenerationLock ? "set" : "none"}
      data-review-visible={proposalReviewVisible ? "true" : "false"}
    >
      <div className="workspace-document-column">
        {documentChrome}
        <input aria-label="Editor" defaultValue="unsaved" />
      </div>
      {proposalReviewVisible ? (
        // 実レビュー面と同じく、面の中に role=region の読み取り面を持つ。
        <div className="proposal-review-host" data-testid="review" ref={proposalReviewRef}>
          <div role="region" tabIndex={-1} aria-label="Proposal review" />
        </div>
      ) : null}
      <button onClick={onReturnToEditing}>Return to editing</button>
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
const proposalState = vi.hoisted(() => ({
  proposal: null as null | { requestId: string; streaming?: boolean },
}));
vi.mock("../../hooks/editor/useLocalAssistProposal", () => ({
  useLocalAssistProposal: () => ({ proposal: proposalState.proposal }),
}));

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
  it("shows the proposal review as the selected mode while it is visible (07 P2)", () => {
    proposalState.proposal = { requestId: "req-1" };
    try {
      render(
        <ConnectedShell
          {...base}
          activeTab={
            {
              name: "draft.md",
              path: "/workspace/draft.md",
              sessionId: "s1",
            } as AppShellProps["activeTab"]
          }
        />,
      );
      expect(document.querySelector("[data-mode]")?.getAttribute("data-mode")).toBe("review");
    } finally {
      proposalState.proposal = null;
    }
  });

  it("closes the review surface but keeps the proposal when Write is pressed (07 P1)", () => {
    proposalState.proposal = { requestId: "req-1" };
    try {
      render(
        <ConnectedShell
          {...base}
          activeTab={
            {
              name: "draft.md",
              path: "/workspace/draft.md",
              sessionId: "s1",
            } as AppShellProps["activeTab"]
          }
        />,
      );
      expect(
        document.querySelector(".workspace")?.getAttribute("data-review-visible"),
      ).toBe("true");

      fireEvent.click(screen.getByRole("button", { name: "Write" }));

      // 面だけを閉じる（提案は保持。反映は利用者の操作）。
      expect(
        document.querySelector(".workspace")?.getAttribute("data-review-visible"),
      ).toBe("false");
      expect(proposalState.proposal).not.toBeNull();
    } finally {
      proposalState.proposal = null;
    }
  });


  it("reopens the same proposal review after returning to editing (07 P2)", async () => {
    // 3つの遷移（「書く」／「案を残して編集に戻る」／「確認 → 提案」）を2本の関数へ統一した。
    // 面が unmount されていても「確認 → 提案」で再表示され、フォーカスも戻ることを固定する。
    proposalState.proposal = { requestId: "req-1" };
    try {
      render(
        <ConnectedShell
          {...base}
          activeTab={
            {
              name: "draft.md",
              path: "/workspace/draft.md",
              sessionId: "s1",
            } as AppShellProps["activeTab"]
          }
        />,
      );
      const reviewVisible = () =>
        document.querySelector(".workspace")?.getAttribute("data-review-visible");
      expect(reviewVisible()).toBe("true");

      // レビュー内の「案を残して編集に戻る」。
      fireEvent.click(screen.getByRole("button", { name: "Return to editing" }));
      expect(reviewVisible()).toBe("false");
      expect(proposalState.proposal).not.toBeNull();

      // 上部ナビの「確認 → 提案」。面が無い状態からでも再表示＋フォーカスされる。
      fireEvent.click(screen.getByRole("button", { name: "Check proposal" }));
      expect(reviewVisible()).toBe("true");
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole("region", { name: "Proposal review" })),
      );
      expect(proposalState.proposal).not.toBeNull();
    } finally {
      proposalState.proposal = null;
    }
  });

  it("passes the generation or cancellation lock down to the workspace", () => {
    // 07: 案のレビューは主編集領域（AppWorkspace の中）へ移したので、
    // ロックはシェルからワークスペースへ渡るところまでを確かめる。
    // 実際に `blocked` になることは AppWorkspace 側のテストで固定している。
    render(<ConnectedShell {...base} appleAssistGenerationLock={{ requestId: "pending" } as AppShellProps["appleAssistGenerationLock"]} />);
    expect(
      document.querySelector(".workspace")?.getAttribute("data-generation-lock"),
    ).toBe("set");
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
  const tab = { id: "doc", sessionId: "conflict", name: "note.md", path: "/note.md", contents: "unsaved" } as NonNullable<AppShellProps["activeTab"]>;
  const compare = vi.fn(); const saveAs = vi.fn(async () => {}); const dismiss = vi.fn();
  render(<ConnectedShell {...base} menuLanguage="en" activeTab={tab} conflictDialogTab={tab}
    reviewTabAgainstDisk={compare} saveConflictAs={saveAs} dismissConflictDialog={dismiss} />);
  fireEvent.click(screen.getByRole("button", { name: action }));
  expect(dismiss).toHaveBeenCalledOnce();
  if (action === "Compare changes") { expect(compare).toHaveBeenCalledWith(tab); expect(saveAs).not.toHaveBeenCalled(); }
  else { expect(saveAs).toHaveBeenCalledOnce(); expect(compare).not.toHaveBeenCalled(); }
});

it("cycles Tab within the conflict surface and ignores IME Escape", () => {
  const tab = { id: "doc", sessionId: "conflict", name: "note.md", path: "/note.md", contents: "unsaved" } as NonNullable<AppShellProps["activeTab"]>;
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
