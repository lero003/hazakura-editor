import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CandidateEditor } from "./CandidateEditor";

afterEach(cleanup);

describe("CandidateEditor", () => {
  function renderCandidateEditor({
    onChange = vi.fn(),
    value = "",
  }: {
    onChange?: (nextValue: string) => void;
    value?: string;
  } = {}) {
    return render(
      <CandidateEditor
        ariaLabel="Manual candidate text"
        documentKey="review-desk-candidate"
        fontSize={14}
        placeholder="Paste candidate text here..."
        readOnly={false}
        spellcheckEnabled={false}
        tabSize={2}
        theme="light"
        value={value}
        wrapLines={true}
        onChange={onChange}
      />,
    );
  }

  it("does not report a user edit when the controlled value is synced", async () => {
    const onChange = vi.fn();
    const { container, rerender } = renderCandidateEditor({ onChange });

    rerender(
      <CandidateEditor
        ariaLabel="Manual candidate text"
        documentKey="review-desk-candidate"
        fontSize={14}
        placeholder="Paste candidate text here..."
        readOnly={false}
        spellcheckEnabled={false}
        tabSize={2}
        theme="light"
        value={"# Draft\n\nproposal body\n"}
        wrapLines={true}
        onChange={onChange}
      />,
    );

    await waitFor(() => {
      expect(container.querySelector(".cm-content")?.textContent).toContain(
        "proposal body",
      );
    });
    expect(onChange).not.toHaveBeenCalled();
  });
});
