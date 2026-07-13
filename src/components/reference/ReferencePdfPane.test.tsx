import {
  act,
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

  it("announces localized loading status while a page is rendering", () => {
    vi.mocked(renderPdfReferencePage).mockImplementationOnce(
      () => new Promise(() => {}),
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

    expect(screen.getByRole("status").textContent).toBe("ページを読み込み中");
  });

  it("gives the rendered PDF page an accessible file-and-page name", async () => {
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
      expect(
        screen.getByRole("img", { name: "a.pdf — ページ 1 / 1" }),
      ).toBeTruthy();
    });
  });

  it("ignores a stale raster when the reference changes mid-render", async () => {
    let resolveFirst: ((image: {
      referenceId: string;
      page: number;
      width: number;
      height: number;
      mime: string;
      dataBase64: string;
    }) => void) | null = null;
    let resolveSecond: ((image: {
      referenceId: string;
      page: number;
      width: number;
      height: number;
      mime: string;
      dataBase64: string;
    }) => void) | null = null;
    vi.mocked(renderPdfReferencePage).mockImplementation((referenceId) => {
      if (referenceId === "pdf-ref-a") {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return new Promise((resolve) => {
        resolveSecond = resolve;
      });
    });

    const firstReference = {
      kind: "pdf" as const,
      path: "/ws/a.pdf",
      name: "a.pdf",
      pageCount: 1,
      referenceId: "pdf-ref-a",
    };
    const secondReference = {
      ...firstReference,
      name: "b.pdf",
      path: "/ws/b.pdf",
      referenceId: "pdf-ref-b",
    };
    const { rerender } = render(
      <ReferencePdfPane
        copy={referenceCompareCopy("ja")}
        pageIndex={0}
        onPageIndexChange={vi.fn()}
        reference={firstReference}
      />,
    );

    await waitFor(() => {
      expect(renderPdfReferencePage).toHaveBeenCalledWith(
        "pdf-ref-a",
        0,
        expect.any(Number),
      );
    });

    rerender(
      <ReferencePdfPane
        copy={referenceCompareCopy("ja")}
        pageIndex={0}
        onPageIndexChange={vi.fn()}
        reference={secondReference}
      />,
    );
    await waitFor(() => {
      expect(renderPdfReferencePage).toHaveBeenCalledWith(
        "pdf-ref-b",
        0,
        expect.any(Number),
      );
    });

    await act(async () => {
      resolveFirst?.({
        referenceId: "pdf-ref-a",
        page: 0,
        width: 200,
        height: 100,
        mime: "image/png",
        dataBase64: "stale",
      });
      await Promise.resolve();
    });
    expect(screen.queryByRole("img", { name: /a\.pdf/ })).toBeNull();

    await act(async () => {
      resolveSecond?.({
        referenceId: "pdf-ref-b",
        page: 0,
        width: 200,
        height: 100,
        mime: "image/png",
        dataBase64: "current",
      });
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(
        screen.getByRole("img", { name: "b.pdf — ページ 1 / 1" }),
      ).toBeTruthy();
    });
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

  it("keeps stale PDF errors in kana when the menu language is kana", async () => {
    vi.mocked(renderPdfReferencePage).mockRejectedValueOnce(
      new Error("Unknown or stale PDF reference id."),
    );

    render(
      <ReferencePdfPane
        copy={referenceCompareCopy("kana")}
        errorLanguage="kana"
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
        "さんしょうPDFの ひらきが つかえません",
      );
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
