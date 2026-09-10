import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getRecoveryCopy, getSafeEditorCopy } from "../../lib/locale";
import type { DraftRecord } from "../../types";
import { StartPanel } from "./StartPanel";

afterEach(() => {
  cleanup();
});

function pathlessDraft(
  recoveryId: string,
  name = "Untitled notes",
): DraftRecord {
  return {
    path: "",
    contents: "body",
    line_ending: "lf",
    savedFingerprint: "fp",
    updatedAt: 1,
    revision: 1,
    name,
    recoveryId,
    origin: "untitled",
  };
}

describe("StartPanel recent file surface", () => {
  it("does not steal focus to Open Folder when a live workspace remains", () => {
    const view = render(<button>Existing workspace action</button>);
    const previous = screen.getByRole("button", { name: "Existing workspace action" });
    previous.focus();
    render(<StartPanel copy={getSafeEditorCopy("en")} liveWorkspaceRootPath="/workspace"
      persistedWorkspaceRootPath="/workspace" onOpenFolder={vi.fn()} onNewFile={vi.fn()} onOpenFile={vi.fn()} />);
    expect(document.activeElement).toBe(previous);
    view.unmount();
  });

  it("keeps folder, new document and file actions connected in the new start layout", () => {
    const onOpenFolder = vi.fn(), onNewFile = vi.fn(), onOpenFile = vi.fn();
    render(<StartPanel copy={getSafeEditorCopy("en")} persistedWorkspaceRootPath={null}
      onOpenFolder={onOpenFolder} onNewFile={onNewFile} onOpenFile={onOpenFile} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open Folder" }));
    for (const name of ["Open Folder", "New File", "Open File"]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    expect(onOpenFolder).toHaveBeenCalledOnce();
    expect(onNewFile).toHaveBeenCalledOnce();
    expect(onOpenFile).toHaveBeenCalledOnce();
  });

  it("does not render legacy file recents or pin controls", () => {
    render(
      <StartPanel
        copy={getSafeEditorCopy("en")}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        persistedWorkspaceRootPath={null}
      />,
    );

    expect(screen.queryByText("Pinned files")).toBeNull();
    expect(screen.queryByText("Recent files")).toBeNull();
    expect(screen.queryByRole("button", { name: "pinned.md" })).toBeNull();
    expect(screen.queryByRole("button", { name: "recent.md" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Pin file" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unpin file" })).toBeNull();
  });

  it("keeps the purpose pitch without repeating a three-line feature list", () => {
    render(
      <StartPanel
        copy={getSafeEditorCopy("en")}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        persistedWorkspaceRootPath={null}
      />,
    );

    const panel = document.querySelector(".start-panel");
    expect(panel?.textContent).toContain("Write, read, and verify.");
    expect(panel?.querySelector(".start-purpose-hints")).toBeNull();
    expect(panel?.textContent).not.toContain("Markdown in the center");
    expect(panel?.textContent).not.toContain("right-hand reference");
    expect(screen.getByLabelText("Start actions").className).toBe(
      "start-actions",
    );
    expect(panel?.getAttribute("data-start-mode")).toBe("first-use");
  });
});

describe("StartPanel returning visit", () => {
  it("offers resume for a persisted workspace that is not live", () => {
    const onReopenPersistedWorkspace = vi.fn();

    render(
      <StartPanel
        copy={getSafeEditorCopy("en")}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onReopenPersistedWorkspace={onReopenPersistedWorkspace}
        persistedWorkspaceRootPath="/Users/me/Writing/novel"
      />,
    );

    const panel = screen.getByTestId("start-panel");
    expect(panel.getAttribute("data-start-mode")).toBe("returning");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "Continue where you left off",
    );

    const resumeButton = screen.getByRole("button", {
      name: 'Open last folder “novel”',
    });
    expect(resumeButton.textContent).toBe("novel");
    expect(screen.getByLabelText("Start actions").classList).toContain(
      "start-actions-secondary",
    );
    expect(
      screen.queryByText("Reopens your last folder.", { exact: false }),
    ).toBeNull();
    expect(screen.queryByText("Continue writing")).toBeNull();

    fireEvent.click(resumeButton);
    expect(onReopenPersistedWorkspace).toHaveBeenCalledTimes(1);
  });

  it("surfaces pathless recovery candidates with restore and discard", () => {
    const onRestoreDraft = vi.fn();
    const onDiscardDraft = vi.fn();
    const draft = pathlessDraft("uuid-recovery-1", "import-notes");

    render(
      <StartPanel
        copy={getSafeEditorCopy("en")}
        onDiscardDraft={onDiscardDraft}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onRestoreDraft={onRestoreDraft}
        pathlessDrafts={[draft]}
        persistedWorkspaceRootPath={null}
        recoveryCopy={getRecoveryCopy("en")}
      />,
    );

    expect(screen.getByTestId("start-panel-recovery")).toBeTruthy();
    expect(screen.getByText("import-notes")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Restore draft" }));
    expect(onRestoreDraft).toHaveBeenCalledWith(draft);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(onDiscardDraft).toHaveBeenCalledWith("pathless:uuid-recovery-1");
    confirmSpy.mockRestore();
  });

  it("keeps Japanese resume and recovery section labels purpose-led", () => {
    render(
      <StartPanel
        copy={getSafeEditorCopy("ja")}
        onDiscardDraft={vi.fn()}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onReopenPersistedWorkspace={vi.fn()}
        onRestoreDraft={vi.fn()}
        pathlessDrafts={[pathlessDraft("uuid-ja")]}
        persistedWorkspaceRootPath="/Users/me/docs/章立て"
        recoveryCopy={getRecoveryCopy("ja")}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
      "続きから書く",
    );
    expect(
      screen.getByRole("button", { name: "前回のフォルダ「章立て」を開く" }),
    ).toBeTruthy();
    expect(screen.getByText("保存前のメモを復旧")).toBeTruthy();
  });

  it("lists recent workspaces for explicit reopen without auto-scan", () => {
    const onOpenRecentWorkspace = vi.fn();

    render(
      <StartPanel
        copy={getSafeEditorCopy("en")}
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onOpenRecentWorkspace={onOpenRecentWorkspace}
        onReopenPersistedWorkspace={vi.fn()}
        persistedWorkspaceRootPath="/Users/me/Writing/novel"
        recentWorkspaces={[
          {
            path: "/Users/me/Writing/novel",
            label: "novel",
            openedAt: 3,
            pinnedAt: null,
          },
          {
            path: "/Users/me/Projects/essays",
            label: "essays",
            openedAt: 2,
            pinnedAt: null,
          },
          {
            path: "/Users/me/Archive/essays",
            label: "essays",
            openedAt: 1,
            pinnedAt: null,
          },
        ]}
      />,
    );

    expect(screen.getByTestId("start-panel-recent-workspaces")).toBeTruthy();
    // Resume owns the last workspace; recents skip that path.
    expect(
      screen.queryByRole("button", { name: 'Open folder “novel”' }),
    ).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: 'Open folder “essays - Projects”' }),
    );
    expect(onOpenRecentWorkspace).toHaveBeenCalledWith(
      "/Users/me/Projects/essays",
    );
    expect(
      screen.getByRole("button", { name: 'Open folder “essays - Archive”' }),
    ).toBeTruthy();
    expect(
      // 行は「名前・補足パス・日時」を出すが、読み上げ名は表示名のまま（上の getByRole が担保）。
      screen.getByRole("button", { name: 'Open folder “essays - Projects”' })
        .textContent,
    ).toContain("essays - Projects");
    expect(
      screen.queryByText("Nothing is scanned automatically.", { exact: false }),
    ).toBeNull();
  });

  it("shows the folder path and opened date on each recent row", () => {
    render(
      <StartPanel
        copy={getSafeEditorCopy("ja")}
        language="ja"
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        onOpenRecentWorkspace={vi.fn()}
        persistedWorkspaceRootPath={null}
        recentWorkspaces={[
          {
            path: "/Users/example/Projects/essays",
            label: "随筆",
            openedAt: Date.now(),
            pinnedAt: null,
          },
          {
            path: "/Users/example/Archive/notes",
            label: "メモ",
            openedAt: new Date(2026, 8, 7, 12, 0, 0).getTime(),
            pinnedAt: null,
          },
        ]}
      />,
    );

    // 名前・補足パス・日時を出す（画像のサンプル日時を固定表示しない）。
    expect(screen.getByText("随筆")).toBeTruthy();
    expect(screen.getByText("/Users/example/Projects")).toBeTruthy();
    expect(screen.getByText("今日")).toBeTruthy();
    expect(screen.getByText("9月7日")).toBeTruthy();
  });

  it("keeps the start actions reachable with an empty history", () => {
    render(
      <StartPanel
        copy={getSafeEditorCopy("ja")}
        language="ja"
        onNewFile={vi.fn()}
        onOpenFile={vi.fn()}
        onOpenFolder={vi.fn()}
        persistedWorkspaceRootPath={null}
      />,
    );

    expect(screen.getByText("最近開いたフォルダはまだありません")).toBeTruthy();
    expect(screen.getByRole("button", { name: "フォルダを開く" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "新規ファイル" })).toBeTruthy();
  });
});
