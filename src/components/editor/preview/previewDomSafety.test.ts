import { afterEach, describe, expect, it, vi } from "vitest";
import { interceptPreviewLink, paintPreviewHtml, subscribePreviewGestureEnd } from "./previewDomSafety";

afterEach(() => { document.body.innerHTML = ""; });

describe("preview DOM boundaries", () => {
  it("paints empty HTML instead of retaining stale content", () => {
    const host = document.createElement("article");
    host.innerHTML = "<p>Old</p>";
    const restore = vi.fn();
    expect(paintPreviewHtml(host, "", "<p>Old</p>", restore)).toBe("");
    expect(host.childElementCount).toBe(0);
    expect(restore).toHaveBeenCalledOnce();
  });
  it("retains node identity when HTML has not changed", () => {
    const host = document.createElement("article");
    host.innerHTML = "<p>Same</p>";
    const paragraph = host.firstChild;
    paintPreviewHtml(host, "<p>Same</p>", "<p>Same</p>", () => {});
    expect(host.firstChild).toBe(paragraph);
  });
  it("captures scroll position at the DOM write, not at scheduling", () => {
    const scroller = document.createElement("div");
    const host = document.createElement("article");
    scroller.append(host);
    scroller.scrollTop = 140;
    paintPreviewHtml(host, "<p>New</p>", null, () => { scroller.scrollTop = 0; });
    expect(scroller.scrollTop).toBe(140);
  });
  it("blocks only links inside the supplied host", () => {
    const host = document.createElement("article");
    host.innerHTML = '<a href="https://example.invalid"><span>Link</span></a>';
    const preventDefault = vi.fn();
    const event = { target: host.querySelector("span"), currentTarget: host, preventDefault };
    expect(interceptPreviewLink(event)).toBe("https://example.invalid");
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(interceptPreviewLink({ ...event, currentTarget: document.createElement("article") })).toBeNull();
    expect(preventDefault).toHaveBeenCalledOnce();
  });
  it("recovers pointerup, cancellation and blur and removes every listener", () => {
    const end = vi.fn();
    const remove = subscribePreviewGestureEnd(document, end);
    document.dispatchEvent(new Event("pointerup"));
    document.dispatchEvent(new Event("pointercancel"));
    window.dispatchEvent(new Event("blur"));
    expect(end).toHaveBeenCalledTimes(3);
    remove();
    document.dispatchEvent(new Event("pointerup"));
    document.dispatchEvent(new Event("pointercancel"));
    window.dispatchEvent(new Event("blur"));
    expect(end).toHaveBeenCalledTimes(3);
  });
});
