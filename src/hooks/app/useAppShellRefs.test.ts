import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppShellRefs } from "./useAppShellRefs";

describe("useAppShellRefs", () => {
  it("returns the editor + dialog ref surface", () => {
    const { result } = renderHook(() =>
      useAppShellRefs({
        pendingAppClose: false,
        pendingCloseTab: null,
        preferencesDialogMode: null,
        tabs: [],
      }),
    );

    // editor refs (4)
    expect(result.current).toHaveProperty("editorPaneRef");
    expect(result.current).toHaveProperty("findInputRef");
    expect(result.current).toHaveProperty("previewPaneRef");
    expect(result.current).toHaveProperty("tabsRef");
    // dialog refs (11)
    expect(result.current).toHaveProperty("allowWindowCloseRef");
    expect(result.current).toHaveProperty("appCloseCancelButtonRef");
    expect(result.current).toHaveProperty("appCloseDialogRef");
    expect(result.current).toHaveProperty("closeTabCancelButtonRef");
    expect(result.current).toHaveProperty("closeTabDialogRef");
    expect(result.current).toHaveProperty("discardingWindowCloseRef");
    expect(result.current).toHaveProperty("modalOpen");
    expect(result.current).toHaveProperty("pendingCloseTabOpen");
    expect(result.current).toHaveProperty("preferencesCloseButtonRef");
    expect(result.current).toHaveProperty("preferencesDialogRef");
    expect(result.current).toHaveProperty("preferencesOpen");
  });
});
