import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { referenceCompareCopy } from "../../lib/locale/referenceCompare";
import { renderPdfReferencePage } from "../../lib/tauri/pdfReference";
import { ReferencePdfPane } from "./ReferencePdfPane";

vi.mock("../../lib/tauri/pdfReference", async () => {
  const actual = await vi.importActual<
    typeof import("../../lib/tauri/pdfReference")
  >("../../lib/tauri/pdfReference");
  return {
    ...actual,
    renderPdfReferencePage: vi.fn(),
    pdfPageImageToDataUrl: (image: {
      mime: string;
      dataBase64: string;
      referenceId: string;
    }) => `data:${image.mime};base64,${image.dataBase64}`,
  };
});

describe("ReferencePdfPane", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.mocked(renderPdfReferencePage).mockReset();
    vi.mocked(renderPdfReferencePage).mockImplementation(
      async (referenceId, page) => ({
        referenceId,
        page,
        width: 200,
        height: 100,
        mime: "image/png",
        dataBase64: `page-${page}`,
      }),
    );
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

    await waitFor(
      () => {
        expect(renderPdfReferencePage).toHaveBeenCalledWith(
          "pdf-ref-1",
          0,
          expect.any(Number),
        );
      },
      { timeout: 3_000 },
    );
    expect(screen.getByText(/ページ 1 \/ 2/)).toBeTruthy();

    const nextPage = screen.getByLabelText("次のページ") as HTMLButtonElement;
    await waitFor(() => {
      expect(nextPage.disabled).toBe(false);
    });
    fireEvent.click(nextPage);
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

  it("shows localized retry when render fails", async () => {
    vi.mocked(renderPdfReferencePage).mockRejectedValueOnce(
      new Error("Unknown or stale PDF reference id."),
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
      expect(screen.getByRole("alert").textContent).toContain(
        "ハンドルが無効",
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "再表示" }));
    await waitFor(() => {
      expect(renderPdfReferencePage).toHaveBeenCalledTimes(2);
    });
  });

  it("navigates pages with keyboard arrows", async () => {
    const onPageIndexChange = vi.fn();
    const { getByTestId } = render(
      <ReferencePdfPane
        copy={referenceCompareCopy("ja")}
        pageIndex={1}
        onPageIndexChange={onPageIndexChange}
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

    const pane = getByTestId("reference-pdf-pane");
    fireEvent.keyDown(pane, { key: "ArrowLeft" });
    expect(onPageIndexChange).toHaveBeenCalledWith(0, "user");
    fireEvent.keyDown(pane, { key: "ArrowRight" });
    expect(onPageIndexChange).toHaveBeenCalledWith(2, "user");
  });

  it("applies 150% display scale from raster width, not only pixel budget", async () => {
    const { getByRole } = render(
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
      const image = getByRole("img") as HTMLImageElement;
      expect(image.src).toContain("data:image/png;base64,page-0");
      expect(image.src).not.toContain("blob:");
    });

    fireEvent.click(getByRole("button", { name: "拡大" }));
    await waitFor(() => {
      const img = getByRole("img") as HTMLImageElement;
      expect(img.style.width).toBe("300px");
    });
  });
});
