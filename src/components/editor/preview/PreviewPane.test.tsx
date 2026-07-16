import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PreviewPane from "./PreviewPane";

vi.mock("../../../lib/tauri", () => ({
  openWorkspaceImage: vi.fn(),
}));

beforeEach(() => {
  // v0.33: PreviewPane の再描画は debounce(200ms setTimeout)になったため、
  // 偽タイマーで200ms進めて描画を確定させる。
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function flushPreviewFrame() {
  await act(async () => {
    // Adaptive debounce (≤480ms) + rAF (+ optional idle timeout).
    vi.advanceTimersByTime(700);
    // Drain any rAF-linked timers used by the scheduler under fake timers.
    try {
      vi.runOnlyPendingTimers();
    } catch {
      // No pending timers left.
    }
  });
  // startTransition commits may settle on a microtask.
  await act(async () => {
    await Promise.resolve();
  });
}

describe("PreviewPane local link routing", () => {
  it("defers the initial markdown render until the next animation frame", async () => {
    const { container } = render(
      <PreviewPane source={["# Large Draft", "", "Body"].join("\n")} />,
    );

    expect(
      screen.queryByRole("heading", { name: "Large Draft" }),
    ).toBeNull();
    expect(container.querySelector(".markdown-preview-loading")).toBeTruthy();

    await flushPreviewFrame();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Large Draft" }),
      ).toBeTruthy();
    });
    expect(container.querySelector(".markdown-preview-loading")).toBeNull();
  });

  it("keeps the current preview visible while same-document edits wait for the next frame", async () => {
    const { container, rerender } = render(
      <PreviewPane
        documentKey="draft-1"
        source={["# Previous Draft", "", "Body"].join("\n")}
      />,
    );
    await flushPreviewFrame();

    expect(
      screen.getByRole("heading", { name: "Previous Draft" }),
    ).toBeTruthy();

    rerender(
      <PreviewPane
        documentKey="draft-1"
        source={["# Next Draft", "", "Body"].join("\n")}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Previous Draft" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("heading", { name: "Next Draft" }),
    ).toBeNull();
    // Same-document refreshes keep the previous HTML without flipping into
    // the loading skeleton (and without an extra pending React commit).
    expect(container.querySelector(".markdown-preview-loading")).toBeNull();

    await flushPreviewFrame();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Next Draft" })).toBeTruthy();
    });
    expect(
      screen.queryByRole("heading", { name: "Previous Draft" }),
    ).toBeNull();
    expect(container.querySelector(".markdown-preview-loading")).toBeNull();
  });

  it("reports initial then update on same-document re-renders", async () => {
    const onRenderComplete = vi.fn();
    const { rerender } = render(
      <PreviewPane
        documentKey="draft-1"
        onRenderComplete={onRenderComplete}
        source={["# First", "", "Body"].join("\n")}
      />,
    );
    await flushPreviewFrame();

    await waitFor(() => {
      expect(onRenderComplete).toHaveBeenCalledWith("initial");
    });
    onRenderComplete.mockClear();

    rerender(
      <PreviewPane
        documentKey="draft-1"
        onRenderComplete={onRenderComplete}
        source={["# First", "", "Body edited"].join("\n")}
      />,
    );
    await flushPreviewFrame();

    await waitFor(() => {
      expect(onRenderComplete).toHaveBeenCalledWith("update");
    });
    expect(onRenderComplete).not.toHaveBeenCalledWith("initial");
  });

  it("clears stale preview content while the next document is waiting for its frame", async () => {
    const { container, rerender } = render(
      <PreviewPane
        documentKey="draft-1"
        source={["# Previous Draft", "", "Body"].join("\n")}
      />,
    );
    await flushPreviewFrame();

    expect(
      screen.getByRole("heading", { name: "Previous Draft" }),
    ).toBeTruthy();

    rerender(
      <PreviewPane
        documentKey="draft-2"
        source={["# Next Draft", "", "Body"].join("\n")}
      />,
    );

    expect(
      screen.queryByRole("heading", { name: "Previous Draft" }),
    ).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Next Draft" }),
    ).toBeNull();
    expect(container.querySelector(".markdown-preview-loading")).toBeTruthy();
  });

  it("prevents in-preview navigation and forwards the clicked href", async () => {
    const onOpenLocalLink = vi.fn();
    render(
      <PreviewPane
        documentPath="/workspace/docs/guide.md"
        onOpenLocalLink={onOpenLocalLink}
        source="[Open note](../notes/%E6%97%A5%E6%9C%AC%E8%AA%9E%20memo.md#section)"
        workspaceRoot="/workspace"
      />,
    );
    await flushPreviewFrame();

    const link = screen.getByRole("link", { name: "Open note" });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    const clickResult = link.dispatchEvent(event);

    expect(clickResult).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpenLocalLink).toHaveBeenCalledWith(
      "../notes/%E6%97%A5%E6%9C%AC%E8%AA%9E%20memo.md#section",
    );
  });

  it("prevents main WebView navigation for external links before routing", async () => {
    const onOpenLocalLink = vi.fn();
    render(
      <PreviewPane
        onOpenLocalLink={onOpenLocalLink}
        source="[Support](https://hazakura.dev/hazakura-editor/support/)"
      />,
    );
    await flushPreviewFrame();

    const link = screen.getByRole("link", { name: "Support" });
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
    });

    const clickResult = link.dispatchEvent(event);

    expect(clickResult).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpenLocalLink).toHaveBeenCalledWith(
      "https://hazakura.dev/hazakura-editor/support/",
    );
  });

  it("does not route clicks outside preview links", async () => {
    const onOpenLocalLink = vi.fn();
    render(
      <PreviewPane
        onOpenLocalLink={onOpenLocalLink}
        source="Plain paragraph"
      />,
    );
    await flushPreviewFrame();

    fireEvent.click(screen.getByText("Plain paragraph"));

    expect(onOpenLocalLink).not.toHaveBeenCalled();
  });
});
