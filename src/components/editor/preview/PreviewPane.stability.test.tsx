import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderMarkdown } from "../../../features/editor/markdown";
import PreviewPane from "./PreviewPane";

// This suite isolates paint/selection lifecycle. Markdown sanitization and
// image access remain covered by the existing real-renderer suites.
vi.mock("../../../features/editor/markdown", () => ({ renderMarkdown: vi.fn() }));
vi.mock("../../../features/editor/previewRenderDebounce", () => ({
  schedulePreviewRender: (paint: () => void) => {
    const timer = setTimeout(paint, 1);
    return () => clearTimeout(timer);
  },
}));
vi.mock("../../../lib/tauri", () => ({
  fetchRemoteImage: vi.fn(), openLocalImageUnderRoots: vi.fn(), openWorkspaceImage: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(renderMarkdown).mockReset().mockImplementation((source) => source);
});
afterEach(() => {
  cleanup();
  window.getSelection()?.removeAllRanges();
  vi.useRealTimers();
});
async function paint() {
  await act(async () => { await vi.advanceTimersByTimeAsync(20); });
}

const good = "<p>Last good text</p>";

describe("PreviewPane recovery", () => {
  it("clears an old DOM for a settled empty document and reports completion", async () => {
    const completed = vi.fn();
    const view = render(<PreviewPane documentKey="a" source={good} onRenderComplete={completed} />);
    await paint();
    view.rerender(<PreviewPane documentKey="a" source="" onRenderComplete={completed} />);
    await paint();
    expect(view.container.querySelector("article")?.innerHTML).toBe("");
    expect(screen.getByRole("status").textContent).toContain("ここにプレビュー");
    expect(completed.mock.calls.map(([kind]) => kind)).toEqual(["initial", "update"]);
  });

  it("completes an initially empty document instead of staying busy", async () => {
    const completed = vi.fn();
    const view = render(<PreviewPane source="" onRenderComplete={completed} />);
    await paint();
    expect(completed).toHaveBeenCalledWith("initial");
    expect(view.container.querySelector("article")?.getAttribute("aria-busy")).toBeNull();
  });

  it("clears another document before its deferred paint runs", async () => {
    const view = render(<PreviewPane documentKey="a" source={good} />);
    await paint();
    view.rerender(<PreviewPane documentKey="b" source="<p>Next document</p>" />);
    expect(view.container.querySelector("article")?.innerHTML).toBe("");
    await paint();
    expect(view.container.querySelector("article")?.textContent).toBe("Next document");
  });

  it("keeps the last good paint on failure and retries without editing source", async () => {
    const completed = vi.fn();
    const view = render(<PreviewPane source={good} onRenderComplete={completed} />);
    await paint();
    vi.mocked(renderMarkdown).mockImplementationOnce(() => { throw new Error("private details"); });
    view.rerender(<PreviewPane source="<p>New text</p>" onRenderComplete={completed} />);
    await paint();
    expect(view.container.querySelector("article")?.textContent).toBe("Last good text");
    expect(screen.getByRole("status").textContent).toContain("最後に表示できた内容");
    expect(view.container.textContent).not.toContain("private details");
    expect(completed).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "もう一度表示" }));
    await paint();
    expect(view.container.querySelector("article")?.textContent).toBe("New text");
    expect(screen.queryByRole("status")).toBeNull();
    expect(completed).toHaveBeenLastCalledWith("update");
  });

  it("never retains another tab on a failed first render", async () => {
    const view = render(<PreviewPane documentKey="a" source={good} />);
    await paint();
    vi.mocked(renderMarkdown).mockImplementationOnce(() => { throw new Error("failure"); });
    view.rerender(<PreviewPane documentKey="b" source="<p>Other</p>" menuLanguage="en" />);
    await paint();
    expect(view.container.querySelector("article")?.innerHTML).toBe("");
    expect(screen.getByRole("button", { name: "Retry preview" })).toBeTruthy();
    expect(view.container.textContent).not.toContain("Last good text");
  });

  it("does not flush a selection paint superseded by newer input", async () => {
    const view = render(<PreviewPane source={good} />);
    await paint();
    const article = view.container.querySelector("article")!;
    fireEvent.pointerDown(article, { button: 0, buttons: 1 });
    view.rerender(<PreviewPane source="<p>Superseded</p>" />);
    await paint();
    view.rerender(<PreviewPane source="<p>Latest</p>" />);
    fireEvent.pointerUp(document);
    expect(article.textContent).toBe("Last good text");
    await paint();
    expect(article.textContent).toBe("Latest");
  });

  it("recovers a pointer release lost outside the window", async () => {
    const view = render(<PreviewPane source={good} />);
    await paint();
    const article = view.container.querySelector("article")!;
    fireEvent.pointerDown(article, { button: 0, buttons: 1 });
    fireEvent.blur(window);
    expect(view.container.hasAttribute("data-preview-selecting")).toBe(false);
    view.rerender(<PreviewPane source="<p>After blur</p>" />);
    await paint();
    expect(article.textContent).toBe("After blur");
  });

  it("recovers when a pointer move reports no primary button", async () => {
    const view = render(<PreviewPane source={good} />);
    await paint();
    const article = view.container.querySelector("article")!;
    fireEvent.pointerDown(article, { button: 0, buttons: 1 });
    fireEvent.pointerMove(document, { buttons: 0 });
    expect(view.container.hasAttribute("data-preview-selecting")).toBe(false);
    view.rerender(<PreviewPane source="<p>Recovered</p>" />);
    await paint();
    expect(article.textContent).toBe("Recovered");
  });

  it("removes the gesture marker from a retained scroller on unmount", async () => {
    const view = render(<PreviewPane source={good} />);
    await paint();
    fireEvent.pointerDown(view.container.querySelector("article")!, { button: 0, buttons: 1 });
    expect(view.container.hasAttribute("data-preview-selecting")).toBe(true);
    view.unmount();
    expect(view.container.hasAttribute("data-preview-selecting")).toBe(false);
  });

  it("blocks normal and middle-click navigation without a route callback", async () => {
    const view = render(<PreviewPane source={'<a href="https://example.invalid"><span>Link</span></a>'} />);
    await paint();
    const target = view.container.querySelector("a span")!;
    expect(fireEvent.click(target)).toBe(false);
    expect(fireEvent(target, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }))).toBe(false);
  });
});
