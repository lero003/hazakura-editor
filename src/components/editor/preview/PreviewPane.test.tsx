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

let pendingAnimationFrames: FrameRequestCallback[] = [];

beforeEach(() => {
  pendingAnimationFrames = [];
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((callback: FrameRequestCallback) => {
      pendingAnimationFrames.push(callback);
      return pendingAnimationFrames.length;
    }),
  );
  vi.stubGlobal(
    "cancelAnimationFrame",
    vi.fn((handle: number) => {
      pendingAnimationFrames[handle - 1] = () => undefined;
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function flushPreviewFrame() {
  const callbacks = pendingAnimationFrames;
  pendingAnimationFrames = [];
  await act(async () => {
    for (const callback of callbacks) {
      callback(performance.now());
    }
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
    expect(container.querySelector(".markdown-preview-loading")).toBeNull();
    expect(
      container.querySelector(".markdown-preview")?.getAttribute("aria-busy"),
    ).toBe("true");

    await flushPreviewFrame();

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Next Draft" })).toBeTruthy();
    });
    expect(
      screen.queryByRole("heading", { name: "Previous Draft" }),
    ).toBeNull();
    expect(container.querySelector(".markdown-preview-loading")).toBeNull();
    expect(
      container.querySelector(".markdown-preview")?.getAttribute("aria-busy"),
    ).toBeNull();
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
