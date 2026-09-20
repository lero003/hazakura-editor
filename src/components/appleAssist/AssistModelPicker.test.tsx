import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AssistModelPicker } from "./AssistModelPicker";

afterEach(cleanup);

describe("AssistModelPicker", () => {
  it("opens even with one model, marks it selected and returns focus on selection", () => {
    render(<AssistModelPicker language="ja" disabled={false} />);
    const trigger = screen.getByRole("button", { name: /モデルを選択/ });
    fireEvent.click(trigger);
    const option = screen.getByRole("menuitemradio", { name: "Apple Intelligence" });
    expect(option.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(option);
    fireEvent.click(option);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("opens from the keyboard and closes with Escape or an outside click", () => {
    render(<AssistModelPicker language="en" disabled={false} />);
    const trigger = screen.getByRole("button", { name: /Choose model/ });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("menuitemradio"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("closes and disables selection when generation begins", () => {
    const { rerender } = render(<AssistModelPicker language="en" disabled={false} />);
    fireEvent.click(screen.getByRole("button"));
    rerender(<AssistModelPicker language="en" disabled />);
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button").hasAttribute("disabled")).toBe(true);
  });

  it("discloses the native-selected Core AI fixture without offering another backend", () => {
    render(<AssistModelPicker language="en" disabled={false} modelId="apple:core-ai:qwen3-0.6b-test" />);
    fireEvent.click(screen.getByRole("button", { name: "Choose model: Core AI · Qwen3 0.6B (test)" }));
    const options = screen.getAllByRole("menuitemradio");
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("Core AI · Qwen3 0.6B (test)");
  });
});
