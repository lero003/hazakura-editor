import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { useExportFocusReturn } from "./useExportFocusReturn";

afterEach(cleanup);

function ExportDialog({ format, onClose, onSwitch }: {
  format: string; onClose: () => void; onSwitch: () => void;
}) {
  return <div role="dialog" aria-modal="true">
    <input aria-label={format} autoFocus />
    <button onClick={onSwitch}>Switch format</button>
    <button onClick={onClose}>Cancel</button>
  </div>;
}

function Host() {
  const [format, setFormat] = useState<string | null>(null);
  useExportFocusReturn(format !== null);
  return <>
    <button onClick={() => setFormat("EPUB")}>Export</button>
    {format && <ExportDialog key={format} format={format}
      onSwitch={() => setFormat("PDF")} onClose={() => setFormat(null)} />}
  </>;
}

it("returns to the export trigger after cancelling, including after a format switch", () => {
  render(<Host />);
  const trigger = screen.getByRole("button", { name: "Export" });
  trigger.focus();
  fireEvent.click(trigger);
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "EPUB" }));
  fireEvent.click(screen.getByRole("button", { name: "Switch format" }));
  expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "PDF" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(document.activeElement).toBe(trigger);
});

it("does not return focus to a trigger that became hidden during export", () => {
  render(<Host />);
  const trigger = screen.getByRole("button", { name: "Export" });
  trigger.focus();
  fireEvent.click(trigger);
  trigger.setAttribute("hidden", "");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(document.activeElement).not.toBe(trigger);
});
