import { afterEach, describe, expect, it, vi } from "vitest";
import { trapFocusInElement } from "./focusTrap";

function dialog(html: string): HTMLElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  for (const element of container.querySelectorAll<HTMLElement>("*")) {
    vi.spyOn(element, "getClientRects").mockReturnValue([{ width: 40, height: 32 }] as unknown as DOMRectList);
  }
  return container;
}
function tab(shiftKey = false): KeyboardEvent { return new KeyboardEvent("keydown", { key: "Tab", shiftKey, cancelable: true }); }
afterEach(() => { document.body.innerHTML = ""; vi.restoreAllMocks(); });

describe("dialog keyboard containment", () => {
  it("wraps forward and backward, including fixed-position controls", () => {
    const container = dialog('<button id="first">First</button><button id="last" style="position:fixed">Last</button>');
    const first = container.querySelector<HTMLElement>("#first")!;
    const last = container.querySelector<HTMLElement>("#last")!;
    last.focus(); const forward = tab(); trapFocusInElement(container, forward);
    expect(document.activeElement).toBe(first); expect(forward.defaultPrevented).toBe(true);
    const backward = tab(true); trapFocusInElement(container, backward);
    expect(document.activeElement).toBe(last); expect(backward.defaultPrevented).toBe(true);
  });
  it("skips disabled, inert, hidden and negative-tabindex elements", () => {
    const container = dialog('<button disabled tabindex="0">Disabled</button><div inert><button>Inert</button></div><div hidden><button>Hidden</button></div><button tabindex="-1">Excluded</button><button id="only">Only</button>');
    trapFocusInElement(container, tab());
    expect(document.activeElement).toBe(container.querySelector("#only"));
  });
  it("keeps focus inside an empty dialog", () => {
    const container = dialog("<p>Loading</p>");
    const event = tab(); trapFocusInElement(container, event);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(container);
  });
  it("does not intercept typing or modified shortcuts", () => {
    const container = dialog("<button>One</button>");
    for (const event of [new KeyboardEvent("keydown", { key: "a", cancelable: true }), new KeyboardEvent("keydown", { key: "Tab", ctrlKey: true, cancelable: true })]) {
      trapFocusInElement(container, event); expect(event.defaultPrevented).toBe(false);
    }
  });
  it("respects positive tabindex ordering", () => {
    const container = dialog('<button tabindex="2">Second</button><button tabindex="1" id="first">First</button><button id="last">Last</button>');
    trapFocusInElement(container, tab()); expect(document.activeElement).toBe(container.querySelector("#first"));
    container.querySelector<HTMLElement>("#last")!.focus();
    trapFocusInElement(container, tab()); expect(document.activeElement).toBe(container.querySelector("#first"));
  });
});
