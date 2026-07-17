import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { referenceCompareCopy } from "../../lib/locale/referenceCompare";
import { ReferenceTextPane } from "./ReferenceTextPane";

afterEach(() => {
  cleanup();
});

describe("ReferenceTextPane", () => {
  it("shows read-only text with line numbers and closes on request", () => {
    const onClose = vi.fn();
    render(
      <ReferenceTextPane
        copy={referenceCompareCopy("ja")}
        menuLanguage="ja"
        onClose={onClose}
        reference={{
          kind: "text",
          path: "/ws/style.md",
          name: "style.md",
          contents: "line one\nline two",
          encoding: "utf-8",
        }}
      />,
    );

    expect(screen.getByTestId("reference-role").textContent).toContain("参照");
    expect(screen.getByTestId("right-pane-header").getAttribute("data-right-pane-mode")).toBe(
      "reference",
    );
    const purpose = screen.getByText(/style\.md · 読み取り専用/);
    expect(purpose.getAttribute("title")).toBe("/ws/style.md");
    expect(screen.getByText("line one")).toBeTruthy();
    expect(screen.getByText("line two")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("参照を閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders an image reference as read-only media with an accessible name", () => {
    render(
      <ReferenceTextPane
        copy={referenceCompareCopy("ja")}
        menuLanguage="ja"
        onClose={vi.fn()}
        reference={{
          kind: "image",
          path: "/ws/cover.png",
          name: "cover.png",
          url: "data:image/png;base64,aaa",
          size: 12,
        }}
      />,
    );

    const image = screen.getByRole("img", { name: "cover.png" });
    expect(image.getAttribute("src")).toBe("data:image/png;base64,aaa");
    expect(screen.getByText(/cover\.png · 読み取り専用/)).toBeTruthy();
    expect(screen.queryByTestId("reference-text-surface")).toBeNull();
  });

  it("uses the kana role label for a read-only reference", () => {
    render(
      <ReferenceTextPane
        copy={referenceCompareCopy("kana")}
        menuLanguage="kana"
        onClose={vi.fn()}
        reference={{
          kind: "text",
          path: "/ws/style.md",
          name: "style.md",
          contents: "line one",
          encoding: "utf-8",
        }}
      />,
    );

    expect(
      screen.getByRole("region", {
        name: "さんしょう: style.md（よみとりせんよう）",
      }),
    ).toBeTruthy();
  });

  it("offers diff action when both sides are text-capable", () => {
    const onShowDiff = vi.fn();
    render(
      <ReferenceTextPane
        copy={referenceCompareCopy("ja")}
        menuLanguage="ja"
        onClose={vi.fn()}
        onShowDiff={onShowDiff}
        reference={{
          kind: "text",
          path: "/ws/a.md",
          name: "a.md",
          contents: "a",
          encoding: "utf-8",
        }}
        showDiffEnabled
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "差分を見る" }));
    expect(onShowDiff).toHaveBeenCalledTimes(1);
  });

  it("shows external-change notice with explicit reload", () => {
    const onReloadReference = vi.fn();
    render(
      <ReferenceTextPane
        copy={referenceCompareCopy("ja")}
        externalChangePending
        menuLanguage="ja"
        onClose={vi.fn()}
        onReloadReference={onReloadReference}
        reference={{
          kind: "text",
          path: "/ws/a.md",
          name: "a.md",
          contents: "a",
          encoding: "utf-8",
        }}
      />,
    );

    expect(screen.getByTestId("reference-external-change").textContent).toContain(
      "参照ファイルが変更されました",
    );
    fireEvent.click(screen.getByTestId("reference-reload"));
    expect(onReloadReference).toHaveBeenCalledTimes(1);
  });

  it("keeps long wrapped text fully mounted for scroll and full-document copy", () => {
    const lines = Array.from({ length: 5000 }, (_, i) => `line-${i + 1}`);
    render(
      <ReferenceTextPane
        copy={referenceCompareCopy("en")}
        menuLanguage="en"
        onClose={vi.fn()}
        reference={{
          kind: "text",
          path: "/ws/long.txt",
          name: "long.txt",
          contents: lines.join("\n"),
          encoding: "utf-8",
        }}
      />,
    );

    const surface = screen.getByTestId("reference-text-surface");
    expect(surface.getAttribute("data-windowed")).toBe("false");
    expect(screen.getByText("line-5000")).toBeTruthy();
    expect(screen.getByText("line-1")).toBeTruthy();
  });
});
