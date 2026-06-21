import { describe, expect, it } from "vitest";
import {
  CANDIDATE_FILE_IMPORT_FAILED_PREFIX,
  CANDIDATE_FILE_IMPORT_NO_ACTIVE_TAB_ERROR,
} from "./locale";
import { localizeStatusMessage } from "./statusMessages";

// v0.15 IPC status feedback.
//
// `useAppPreferences` and `useWindowTitle` route reliable
// IPC failures (window theme, window background color,
// window title) through the existing status bar via
// `localizeStatusMessage`. The Agent window theme IPC is
// deliberately NOT covered: `setAgentWindowTheme` swallows
// the IPC error internally and resolves with `void`, so a
// status message routed through the outer `.catch` would
// never reach the user. Keeping it out of the status bar
// is the honest move until that helper is reshaped to
// throw on failure.
//
// The tests below pin:
//   - each new exact-match key returns a Japanese string
//     for `ja`,
//   - the Japanese strings carry the failure noun (失敗)
//     so the user understands the action did not take
//     effect,
//   - the English path is unchanged (the raw English key is
//     returned for `en`),
//   - the keys stay distinct so future copy edits do
//     not collapse them.

describe("localizeStatusMessage: window IPC failure keys (v0.15)", () => {
  it("localizes the window theme failure to Japanese", () => {
    expect(localizeStatusMessage("Failed to update window theme", "ja"))
      .toBe("ウィンドウのテーマ更新に失敗しました");
  });

  it("localizes the window background color failure to Japanese", () => {
    expect(
      localizeStatusMessage(
        "Failed to update window background color",
        "ja",
      ),
    ).toBe("ウィンドウの背景色更新に失敗しました");
  });

  it("localizes the window title failure to Japanese", () => {
    expect(localizeStatusMessage("Failed to update window title", "ja"))
      .toBe("ウィンドウのタイトル更新に失敗しました");
  });

  it("localizes the app menu state failure to Japanese", () => {
    expect(localizeStatusMessage("Failed to update app menu state", "ja"))
      .toBe("アプリケーションメニューの状態更新に失敗しました");
  });

  it("localizes the theme menu state failure to Japanese", () => {
    expect(localizeStatusMessage("Failed to update theme menu state", "ja"))
      .toBe("テーマメニューの状態更新に失敗しました");
  });

  it("localizes the print unavailable status to Japanese", () => {
    expect(localizeStatusMessage("Print unavailable", "ja"))
      .toBe("印刷できません");
  });

  it("returns the raw English key when menu language is English", () => {
    expect(localizeStatusMessage("Print unavailable", "en"))
      .toBe("Print unavailable");
  });

  it("mentions the failure noun (失敗) so the user sees the action did not take effect", () => {
    expect(localizeStatusMessage("Failed to update window theme", "ja"))
      .toMatch(/失敗/);
    expect(
      localizeStatusMessage(
        "Failed to update window background color",
        "ja",
      ),
    ).toMatch(/失敗/);
    expect(localizeStatusMessage("Failed to update window title", "ja"))
      .toMatch(/失敗/);
    expect(localizeStatusMessage("Failed to update app menu state", "ja"))
      .toMatch(/失敗/);
    expect(localizeStatusMessage("Failed to update theme menu state", "ja"))
      .toMatch(/失敗/);
  });

  it("returns the raw English key when menu language is English", () => {
    expect(localizeStatusMessage("Failed to update window theme", "en"))
      .toBe("Failed to update window theme");
    expect(
      localizeStatusMessage(
        "Failed to update window background color",
        "en",
      ),
    ).toBe("Failed to update window background color");
    expect(localizeStatusMessage("Failed to update window title", "en"))
      .toBe("Failed to update window title");
    expect(localizeStatusMessage("Failed to update app menu state", "en"))
      .toBe("Failed to update app menu state");
    expect(localizeStatusMessage("Failed to update theme menu state", "en"))
      .toBe("Failed to update theme menu state");
  });

  it("returns distinct Japanese messages for the three keys (no copy collapse)", () => {
    const a = localizeStatusMessage("Failed to update window theme", "ja");
    const b = localizeStatusMessage(
      "Failed to update window background color",
      "ja",
    );
    const c = localizeStatusMessage("Failed to update window title", "ja");
    const d = localizeStatusMessage("Failed to update app menu state", "ja");
    const e = localizeStatusMessage("Failed to update theme menu state", "ja");
    expect(new Set([a, b, c, d, e]).size).toBe(5);
  });
});

describe("localizeStatusMessage: pasted image failures", () => {
  it("localizes the pasted image failure prefix while preserving the Rust reason", () => {
    expect(
      localizeStatusMessage(
        "Image paste failed: Pasted image is larger than the image limit of 20 MB.",
        "ja",
      ),
    ).toBe(
      "画像の貼り付けに失敗しました: Pasted image is larger than the image limit of 20 MB.",
    );
  });
});

describe("localizeStatusMessage: Review Desk candidate file import", () => {
  it("localizes stable candidate file import errors to Japanese", () => {
    expect(
      localizeStatusMessage(CANDIDATE_FILE_IMPORT_NO_ACTIVE_TAB_ERROR, "ja"),
    ).toBe(
      "候補ファイルを読み込むには、エディタでテキストファイルを開いてください。",
    );
  });

  it("localizes the candidate file import failure prefix while preserving the detail", () => {
    expect(
      localizeStatusMessage(
        `${CANDIDATE_FILE_IMPORT_FAILED_PREFIX}Cannot decode selected file`,
        "ja",
      ),
    ).toBe(
      "候補ファイルを読み込めませんでした: Cannot decode selected file",
    );
  });
});

// v0.16 sandbox-file-restore: the workspace restore hook now
// reports the count of tabs that could not be reopened on app
// restart, because the OS no longer grants access to their
// stored path. The status text is built dynamically
// (`Workspace restored: N tab(s) reopened, M path(s) skipped
// (use Open or Open Folder to reauthorize)`), so the
// localization path is a prefix match on the stable
// `Workspace restored: ` prefix. The tests below pin the
// prefix translation and the reauthorization hint wording so
// future copy edits to either the count format or the
// reauth hint keep the Japanese UI consistent.
describe("localizeStatusMessage: workspace restore reauth hint (v0.16)", () => {
  it("translates the Workspace restored: prefix to Japanese", () => {
    expect(
      localizeStatusMessage(
        "Workspace restored: 1 tab reopened, 1 path skipped (use Open or Open Folder to reauthorize)",
        "ja",
      ),
    ).toBe(
      "ワークスペースを復元しました: 1 tab reopened, 1 path skipped (use Open or Open Folder to reauthorize)",
    );
  });

  it("translates the Workspace restored: prefix to Japanese for the plural form", () => {
    expect(
      localizeStatusMessage(
        "Workspace restored: 3 tabs reopened, 2 paths skipped (use Open or Open Folder to reauthorize)",
        "ja",
      ),
    ).toBe(
      "ワークスペースを復元しました: 3 tabs reopened, 2 paths skipped (use Open or Open Folder to reauthorize)",
    );
  });

  it("preserves the Open / Open Folder reauth hint in the localized form", () => {
    const localized = localizeStatusMessage(
      "Workspace restored: 1 tab reopened, 1 path skipped (use Open or Open Folder to reauthorize)",
      "ja",
    );
    expect(localized).toContain("Open");
    expect(localized).toContain("Open Folder");
    expect(localized).toContain("reauthorize");
  });

  it("returns the raw English key for the prefix form when menu language is English", () => {
    expect(
      localizeStatusMessage(
        "Workspace restored: 1 tab reopened, 2 paths skipped (use Open or Open Folder to reauthorize)",
        "en",
      ),
    ).toBe(
      "Workspace restored: 1 tab reopened, 2 paths skipped (use Open or Open Folder to reauthorize)",
    );
  });

  it("does not collapse the dynamic prefix form into the exact-match 'Workspace restored' key", () => {
    // The exact-match key is for the all-reopened success case
    // and would lose the reauth hint. The prefix form must
    // route through its own branch.
    const exact = localizeStatusMessage("Workspace restored", "ja");
    const dynamic = localizeStatusMessage(
      "Workspace restored: 1 tab reopened, 1 path skipped (use Open or Open Folder to reauthorize)",
      "ja",
    );
    expect(dynamic).not.toBe(exact);
    expect(exact).toBe("ワークスペースを復元しました");
  });
});
