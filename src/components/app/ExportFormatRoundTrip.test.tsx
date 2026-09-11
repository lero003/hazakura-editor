import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EpubExportSettingsDialog } from "./EpubExportSettingsDialog";
import { ExportFormatNav, type ExportFormatId } from "./ExportFormatNav";
import { HtmlExportSettingsDialog } from "./HtmlExportSettingsDialog";
import { PdfExportSettingsDialog } from "./PdfExportSettingsDialog";
import { useExportDrafts } from "../../hooks/document/useExportDrafts";

afterEach(cleanup);

/**
 * AppOverlays の配線（`useExportDrafts` ＋ 実ダイアログ＋形式ナビ）を写したハーネス。
 * 3コマンドを残したまま、**一度の書き出し操作のあいだ**入力と対象が続くことを確かめる。
 */
function Harness({ documentKey = "doc-1" }: { documentKey?: string }) {
  const drafts = useExportDrafts(documentKey);
  const [format, setFormat] = useState<ExportFormatId>("epub");
  const [open, setOpen] = useState(true);
  const nav = (
    <ExportFormatNav
      format={format}
      menuLanguage="ja"
      onSelectFormat={setFormat}
    />
  );
  const common = {
    bookAvailable: true,
    cancelButtonRef: { current: null },
    dialogRef: { current: null },
    documentName: "note.md",
    hasUnsavedChanges: false,
    menuLanguage: "ja" as const,
    // 利用者のキャンセル・確定は「この書き出し操作の終了」なので草稿を捨てる。
    // **形式切替の内部キャンセルでは捨てない**（切替は同じ操作の途中）。
    onCancel: () => {
      drafts.clear();
      setOpen(false);
    },
    onConfirm: () => {
      drafts.clear();
      setOpen(false);
    },
  };
  return (
    <>
      {!open ? (
        <button onClick={() => setOpen(true)}>書き出しを開く</button>
      ) : null}
      {open && format === "epub" ? (
        <EpubExportSettingsDialog
          key={documentKey}
          {...common}
          formatNav={nav}
          initialScope={drafts.drafts.scope ?? "document"}
          initialSettings={
            drafts.drafts.epub ?? { author: "", language: "ja", title: "" }
          }
          onDraftChange={drafts.rememberEpub}
        />
      ) : null}
      {open && format === "pdf" ? (
        <PdfExportSettingsDialog
          key={documentKey}
          {...common}
          formatNav={nav}
          initialPreset={drafts.drafts.pdf ?? "standard"}
          initialScope={drafts.drafts.scope ?? "document"}
          onDraftChange={drafts.rememberPdf}
        />
      ) : null}
      {open && format === "html" ? (
        <HtmlExportSettingsDialog
          key={documentKey}
          {...common}
          formatNav={nav}
          request={{
            documentName: "note.md",
            hasUnsavedChanges: false,
            sessionId: "s1",
            tabId: "t1",
            workspaceRootPath: null,
          }}
        />
      ) : null}
    </>
  );
}

describe("export format round trip (画面11)", () => {
  it("keeps the entered settings and the export range when switching formats", () => {
    render(<Harness />);

    // EPUB: 書名・著者を入れ、「本全体」を選ぶ。
    fireEvent.change(screen.getByLabelText("書名"), {
      target: { value: "葉桜の本" },
    });
    fireEvent.change(screen.getByLabelText("著者名"), {
      target: { value: "藤原千花" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "本全体" }));

    // PDF へ切り替え（往路）。
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect(screen.queryByLabelText("書名")).toBeNull();
    expect(screen.getByRole("dialog")).toBeTruthy();

    // EPUB へ戻る（復路）。入力と対象が残っている。
    fireEvent.click(screen.getByRole("button", { name: "電子書籍（EPUB）" }));
    const title = screen.getByLabelText("書名") as HTMLInputElement;
    expect(title.value).toBe("葉桜の本");
    expect((screen.getByLabelText("著者名") as HTMLInputElement).value).toBe("藤原千花");
    expect((screen.getByRole("radio", { name: "本全体" }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it("keeps the PDF margin preset on the way back", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    fireEvent.click(screen.getByRole("radio", { name: /広い/ }));
    fireEvent.click(screen.getByRole("button", { name: "電子書籍（EPUB）" }));
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect(
      (screen.getByRole("radio", { name: /広い/ }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("keeps only one dialog and the HTML book note while switching", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "HTML" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      screen.getByText(/「本全体」は PDF と EPUB で書き出せます/),
    ).toBeTruthy();
  });

  it("drops the entries when the export operation ends, on cancel", () => {
    // 「同じ文書なら次回も覚えておく」ではなく、**今回の操作のあいだだけ**保持する。
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("書名"), {
      target: { value: "一度きりの本" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "本全体" }));

    // 利用者のキャンセル（＝この書き出し操作は終わり）。
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByLabelText("書名")).toBeNull();

    // 改めて書き出しを始めると、既定（文書・空欄）から始まる。
    fireEvent.click(screen.getByRole("button", { name: "書き出しを開く" }));
    expect((screen.getByLabelText("書名") as HTMLInputElement).value).toBe("");
    // 対象も既定（この文書）へ戻る（`book` が持ち越されない）。
    expect(
      (screen.getByRole("radio", { name: "現在のファイル" }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("does not carry the previous document's entries into another document", () => {
    const { rerender } = render(<Harness documentKey="doc-1" />);
    fireEvent.change(screen.getByLabelText("書名"), {
      target: { value: "前の文書の本" },
    });
    // 文書が変われば、前の文書の入力を初期化する（保存はしない）。
    rerender(<Harness documentKey="doc-2" />);
    expect((screen.getByLabelText("書名") as HTMLInputElement).value).toBe("");
  });
});
