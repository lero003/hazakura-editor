import { describe, expect, it } from "vitest";
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

  it("localizes the PDF export unavailable status to Japanese", () => {
    expect(localizeStatusMessage("PDF export unavailable", "ja")).toBe(
      "PDFを書き出せません",
    );
  });

  it("returns the raw English key when menu language is English", () => {
    expect(localizeStatusMessage("PDF export unavailable", "en")).toBe(
      "PDF export unavailable",
    );
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

describe("localizeStatusMessage: v1.12 OKF scaffold follow-up", () => {
  it("keeps partial post-create failures understandable in Japanese", () => {
    expect(
      localizeStatusMessage(
        "OKF scaffold created; index open failed",
        "ja",
      ),
    ).toBe(
      "知識フォルダのひな形を作成しました。index.md を開けませんでした",
    );
    expect(
      localizeStatusMessage(
        "OKF scaffold created; folder refresh and index open failed",
        "ja",
      ),
    ).toContain("フォルダ更新と index.md の表示には失敗しました");
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

describe("localizeStatusMessage: EPUB export polish", () => {
  it("localizes successful EPUB export without beta wording", () => {
    expect(localizeStatusMessage("Exported EPUB: /tmp/book.epub", "ja"))
      .toBe("EPUBを保存しました: /tmp/book.epub");
  });

  it("localizes successful EPUB export with image warnings", () => {
    expect(
      localizeStatusMessage(
        "Exported EPUB with image warnings: /tmp/book.epub",
        "ja",
      ),
    ).toBe("EPUBを保存しました（一部の画像は置き換えました）: /tmp/book.epub");
  });

  it("keeps the English EPUB export status unchanged", () => {
    expect(localizeStatusMessage("Exported EPUB: /tmp/book.epub", "en"))
      .toBe("Exported EPUB: /tmp/book.epub");
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
      "ワークスペースを復元しました: 1 個のタブを再開, 1 件のパスをスキップ（ファイルを開く／フォルダを開くで権限を付け直してください）",
    );
  });

  it("translates the Workspace restored: prefix to Japanese for the plural form", () => {
    expect(
      localizeStatusMessage(
        "Workspace restored: 3 tabs reopened, 2 paths skipped (use Open or Open Folder to reauthorize)",
        "ja",
      ),
    ).toBe(
      "ワークスペースを復元しました: 3 個のタブを再開, 2 件のパスをスキップ（ファイルを開く／フォルダを開くで権限を付け直してください）",
    );
  });

  it("localizes the Open / Open Folder reauth hint", () => {
    const localized = localizeStatusMessage(
      "Workspace restored: 1 tab reopened, 1 path skipped (use Open or Open Folder to reauthorize)",
      "ja",
    );
    expect(localized).toContain("ファイルを開く");
    expect(localized).toContain("フォルダを開く");
    expect(localized).toContain("権限を付け直してください");
  });

  it("localizes Reference open status messages", () => {
    expect(localizeStatusMessage("Reference open failed", "ja")).toBe(
      "参照を開けませんでした",
    );
    expect(
      localizeStatusMessage("Reference opened: notes.pdf", "ja"),
    ).toBe("参照を開きました: notes.pdf");
    expect(localizeStatusMessage("Reference closed", "ja")).toBe(
      "参照を閉じました",
    );
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
