import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { referenceCompareCopy } from "../../lib/locale/referenceCompare";
import { renderPdfReferencePage } from "../../lib/tauri/pdfReference";
import { ReferencePdfPane } from "./ReferencePdfPane";

vi.mock("../../lib/tauri/pdfReference", () => ({
  renderPdfReferencePage: vi.fn(),
  pdfPageImageToDataUrl: (image: { mime: string; dataBase64: string }) =>
    `data:${image.mime};base64,${image.dataBase64}`,
}));

describe("ReferencePdfPane", () => {
  beforeEach(() => {
    vi.mocked(renderPdfReferencePage).mockReset();
    vi.mocked(renderPdfReferencePage).mockResolvedValue({
      referenceId: "pdf-ref-1",
      page: 0,
      width: 10,
      height: 10,
      mime: "image/png",
      dataBase64: "abc",
    });
  });

  it("renders page 1 and advances with next", async () => {
    vi.mocked(renderPdfReferencePage)
      .mockResolvedValueOnce({
        referenceId: "pdf-ref-1",
        page: 0,
        width: 10,
        height: 10,
        mime: "image/png",
        dataBase64: "page0",
      })
      .mockResolvedValueOnce({
        referenceId: "pdf-ref-1",
        page: 1,
        width: 10,
        height: 10,
        mime: "image/png",
        dataBase64: "page1",
      });

    render(
      <ReferencePdfPane
        copy={referenceCompareCopy("ja")}
        reference={{
          kind: "pdf",
          path: "/ws/a.pdf",
          name: "a.pdf",
          pageCount: 2,
          referenceId: "pdf-ref-1",
        }}
      />,
    );

    await waitFor(() => {
      expect(renderPdfReferencePage).toHaveBeenCalledWith(
        "pdf-ref-1",
        0,
        expect.any(Number),
      );
    });
    expect(screen.getByText(/ページ 1 \/ 2/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("次のページ"));

    await waitFor(() => {
      expect(renderPdfReferencePage).toHaveBeenCalledWith(
        "pdf-ref-1",
        1,
        expect.any(Number),
      );
    });
    expect(screen.getByText(/ページ 2 \/ 2/)).toBeTruthy();
  });

  it("shows retry when render fails", async () => {
    vi.mocked(renderPdfReferencePage).mockRejectedValueOnce(
      new Error("render failed"),
    );

    render(
      <ReferencePdfPane
        copy={referenceCompareCopy("ja")}
        reference={{
          kind: "pdf",
          path: "/ws/a.pdf",
          name: "a.pdf",
          pageCount: 1,
          referenceId: "pdf-ref-1",
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("render failed");
    });
    fireEvent.click(screen.getByRole("button", { name: "再表示" }));
    await waitFor(() => {
      expect(renderPdfReferencePage).toHaveBeenCalledTimes(2);
    });
  });
});
