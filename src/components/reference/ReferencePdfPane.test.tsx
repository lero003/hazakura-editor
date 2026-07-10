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

  it("renders the controlled page and reports user navigation", async () => {
    const onPageIndexChange = vi.fn();
    vi.mocked(renderPdfReferencePage).mockResolvedValue({
      referenceId: "pdf-ref-1",
      page: 0,
      width: 10,
      height: 10,
      mime: "image/png",
      dataBase64: "page0",
    });

    render(
      <ReferencePdfPane
        copy={referenceCompareCopy("ja")}
        pageIndex={0}
        onPageIndexChange={onPageIndexChange}
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
    expect(onPageIndexChange).toHaveBeenCalledWith(1, "user");
  });

  it("offers advisory review navigation without claiming correctness", async () => {
    const onPageIndexChange = vi.fn();
    render(
      <ReferencePdfPane
        copy={referenceCompareCopy("ja")}
        pageIndex={0}
        onPageIndexChange={onPageIndexChange}
        reviewPageIndices={[1, 2]}
        reference={{
          kind: "pdf",
          path: "/ws/a.pdf",
          name: "a.pdf",
          pageCount: 3,
          referenceId: "pdf-ref-1",
        }}
      />,
    );

    await waitFor(() => {
      expect(renderPdfReferencePage).toHaveBeenCalled();
    });
    expect(screen.getByTestId("reference-review-status").textContent).toContain(
      "要確認",
    );
    expect(screen.getByText(/目安です/)).toBeTruthy();
    fireEvent.click(screen.getByTestId("reference-next-review"));
    expect(onPageIndexChange).toHaveBeenCalledWith(1, "user");
  });

  it("shows resume follow when paused", async () => {
    const onResumeFollow = vi.fn();
    render(
      <ReferencePdfPane
        copy={referenceCompareCopy("ja")}
        pageIndex={0}
        onPageIndexChange={vi.fn()}
        followPaused
        onResumeFollow={onResumeFollow}
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
      expect(renderPdfReferencePage).toHaveBeenCalled();
    });
    fireEvent.click(screen.getByTestId("reference-resume-follow"));
    expect(onResumeFollow).toHaveBeenCalledTimes(1);
  });

  it("shows retry when render fails", async () => {
    vi.mocked(renderPdfReferencePage).mockRejectedValueOnce(
      new Error("render failed"),
    );

    render(
      <ReferencePdfPane
        copy={referenceCompareCopy("ja")}
        pageIndex={0}
        onPageIndexChange={vi.fn()}
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
