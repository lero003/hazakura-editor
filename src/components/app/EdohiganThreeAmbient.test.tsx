import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EdohiganThreeAmbient } from "./EdohiganThreeAmbient";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("EdohiganThreeAmbient", () => {
  it("renders nothing when the ambient is off", () => {
    const { container } = render(<EdohiganThreeAmbient intensity="off" />);
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".edohigan-ambient")).toBeNull();
  });

  it("falls back to the CSS scene when WebGL2 is unavailable", async () => {
    // jsdom は WebGL を実装しない。three の WebGLRenderer はここで構築に失敗するので、
    // ユーザーには従来の CSS 版（枝花と CSS 花弁）が出ている必要がある。
    const { container } = render(<EdohiganThreeAmbient intensity="normal" />);
    await waitFor(() => {
      expect(container.querySelector(".edohigan-ambient")).not.toBeNull();
    });
    expect(container.querySelector("canvas")).toBeNull();
    expect(container.querySelector(".edohigan-ambient")?.getAttribute("data-intensity")).toBe(
      "normal",
    );
  });
});

// 強度の切り替えで canvas を捨てない（GL コンテキストを作り直さない）契約は、
// 実 WebGL が要るため隔離 WKWebView のスパイク計測で確認する。
