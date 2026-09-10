import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportFormatNav } from "./ExportFormatNav";

afterEach(cleanup);

describe("ExportFormatNav (画面11)", () => {
  it("marks the open format and switches to another one", () => {
    const onSelectFormat = vi.fn();
    render(
      <ExportFormatNav
        format="pdf"
        menuLanguage="ja"
        onSelectFormat={onSelectFormat}
      />,
    );

    const group = screen.getByRole("group", { name: "書き出す形式" });
    const pdf = screen.getByRole("button", { name: "PDF" });
    expect(pdf.getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", { name: "電子書籍（EPUB）" }).getAttribute("aria-pressed"),
    ).toBe("false");
    expect(group).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "HTML" }));
    expect(onSelectFormat).toHaveBeenCalledExactlyOnceWith("html");
  });

  it("does not re-open the format that is already showing", () => {
    const onSelectFormat = vi.fn();
    render(
      <ExportFormatNav
        format="epub"
        menuLanguage="en"
        onSelectFormat={onSelectFormat}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "E-book (EPUB)" }));
    // 同じ形式を押しても、書き出しの準備をやり直さない。
    expect(onSelectFormat).not.toHaveBeenCalled();
  });

  it("names the formats in the active language", () => {
    const { unmount } = render(
      <ExportFormatNav format="epub" menuLanguage="kana" onSelectFormat={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "でんし しょせき（EPUB）" })).toBeTruthy();
    unmount();
    render(<ExportFormatNav format="html" menuLanguage="en" onSelectFormat={() => {}} />);
    expect(screen.getByRole("group", { name: "Export format" })).toBeTruthy();
  });
});
