import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

  it("offers ready catalog models and sends only the selected catalog id", () => {
    const onSelect = vi.fn();
    render(<AssistModelPicker language="ja" disabled={false}
      modelId="apple:foundation-models:system-default"
      models={[
        { id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system", status: "ready", selected: true },
        { id: "apple:core-ai:writing-primary", displayName: "Hazakura Core AI", kind: "core_ai", status: "ready", selected: false },
        { id: "apple:core-ai:future", displayName: "Future model", kind: "core_ai", status: "not_published", selected: false },
      ]}
      onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /モデルを選択/ }));
    expect(screen.getByRole("menuitemradio", { name: "Future model" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Hazakura Core AI" }));
    expect(onSelect).toHaveBeenCalledWith("apple:core-ai:writing-primary");
  });
});
