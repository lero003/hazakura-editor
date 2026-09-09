import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DiffPane } from "./DiffPane";
import type { CompareCase, CompareViewState } from "../../types";
afterEach(cleanup);
const comparison: Extract<CompareCase, { kind: "file" }> = {
  kind: "file", key: "reference", leftPath: "/ref.md", rightPath: "/doc.md",
  anchor: { path: "/ref.md", name: "Reference.md", label: "Source" },
  target: { path: "/doc.md", name: "Document.md", label: "Editor" },
};
const view: CompareViewState = { caseKey: comparison.key, lines: [], additions: 0, removals: 0 };
it("focuses the comparison on opening, but not on unrelated rerenders", async () => {
  const props = { compareCase: comparison, view, menuLanguage: "en" as const, onClose: () => {} };
  const { rerender } = render(<><button>Editor action</button><DiffPane {...props} /></>);
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close comparison result" })));
  screen.getByRole("button", { name: "Editor action" }).focus();
  rerender(<><button>Editor action</button><DiffPane {...props} /></>);
  expect(document.activeElement?.textContent).toBe("Editor action");
  expect(screen.getByText("Read-only comparison. Closing it does not change or save the document.")).toBeTruthy();
});
it("does not take focus from an open modal", async () => {
  render(<><div role="dialog" aria-modal="true"><button autoFocus>Dialog action</button></div>
    <DiffPane compareCase={comparison} view={view} menuLanguage="en" onClose={() => {}} /></>);
  await new Promise(resolve => setTimeout(resolve, 30));
  expect(document.activeElement?.textContent).toBe("Dialog action");
});
