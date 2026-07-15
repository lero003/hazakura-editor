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

  it("shows purpose-led write / read / verify hints", () => {
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
    expect(panel?.textContent).toMatch(/Write/);
    expect(panel?.textContent).toMatch(/Read/);
    expect(panel?.textContent).toMatch(/Verify/);
    expect(panel?.querySelectorAll(".start-purpose-hints li").length).toBe(3);
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

    fireEvent.click(
      screen.getByRole("button", { name: 'Open last folder “novel”' }),
    );
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
});
