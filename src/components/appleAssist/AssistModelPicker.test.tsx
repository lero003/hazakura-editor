import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistModelPicker } from "./AssistModelPicker";

afterEach(cleanup);

describe("AssistModelPicker", () => {
  it("opens model management from the Local Assist model menu", async () => {
    const onManage = vi.fn();
    render(<AssistModelPicker language="ja" disabled={false} onManage={onManage} />);
    fireEvent.click(screen.getByRole("button", { name: /モデルを選択/ }));
    const manage = screen.getByRole("menuitem", { name: "モデルを追加・管理…" });
    fireEvent.keyDown(screen.getByRole("menuitemradio"), { key: "End" });
    expect(document.activeElement).toBe(manage);
    fireEvent.click(manage);
    expect(onManage).toHaveBeenCalledOnce();
  });
  it("keeps a missing registered folder visible while allowing a switch to System", () => {
    const onSelect = vi.fn();
    render(<AssistModelPicker language="ja" disabled={false} modelId="local:external:missing"
      onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: /ローカルモデルが見つかりません/ }));
    expect(screen.getByRole("menuitemradio", { name: "ローカルモデルが見つかりません" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Apple Intelligence" }));
    expect(onSelect).toHaveBeenCalledWith("apple:foundation-models:system-default");
  });
  const localModels = [
    { id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system" as const, status: "ready" as const, selected: true },
    { id: "local:app-managed:Local", displayName: "Local model", kind: "core_ai" as const, source: "app_managed_local" as const, status: "detected" as const, selected: false },
    { id: "local:app-managed:Broken", displayName: "Broken model", kind: "core_ai" as const, source: "app_managed_local" as const, status: "failed" as const, selected: false },
  ];

  it("selects detected local models by keyboard while skipping broken bundles", () => {
    const onSelect = vi.fn();
    render(<AssistModelPicker language="en" disabled={false}
      modelId={localModels[0].id} models={localModels} onSelect={onSelect} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
    fireEvent.keyDown(screen.getByRole("menuitemradio", { name: "Apple Intelligence" }), { key: "ArrowDown" });
    const local = screen.getByRole("menuitemradio", { name: "Local model" });
    expect(document.activeElement).toBe(local);
    expect(local.hasAttribute("disabled")).toBe(false);
    expect(screen.getByRole("menuitemradio", { name: "Broken model" }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(local);
    expect(onSelect).toHaveBeenCalledWith(localModels[1].id);
  });

  it("focuses the selected local model and preserves it across catalog updates", () => {
    const props = { language: "en" as const, disabled: false, modelId: localModels[1].id };
    const { rerender } = render(<AssistModelPicker {...props} models={localModels} />);
    fireEvent.click(screen.getByRole("button"));
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "Local model" }));
    rerender(<AssistModelPicker {...props} models={localModels.map((model) => ({ ...model }))} />);
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "Local model" }));
  });

  it("keeps System selectable when the selected local folder disappears", () => {
    const onSelect = vi.fn();
    render(<AssistModelPicker language="en" disabled={false}
      modelId={localModels[1].id} models={[localModels[0]]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button"));
    const system = screen.getByRole("menuitemradio", { name: "Apple Intelligence" });
    expect(document.activeElement).toBe(system);
    expect(screen.getByRole("menuitemradio", { checked: true }).hasAttribute("disabled")).toBe(true);
    fireEvent.click(system);
    expect(onSelect).toHaveBeenCalledWith(localModels[0].id);
  });

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

  it("does not let the production catalog hide a native developer test model", () => {
    const onSelect = vi.fn();
    render(<AssistModelPicker language="en" disabled={false}
      modelId="apple:core-ai:qwen3-0.6b-test"
      models={[{ id: "apple:foundation-models:system-default", displayName: "Apple Intelligence", kind: "system", status: "ready", selected: true }]}
      onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Choose model: Core AI · Qwen3 0.6B (test)" }));
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(1);
    fireEvent.click(screen.getByRole("menuitemradio"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("preserves the focused model across progress-only catalog updates", () => {
    const models = [
      { id: "system", displayName: "System", kind: "system" as const, status: "ready" as const, selected: true },
      { id: "core", displayName: "Core", kind: "core_ai" as const, status: "ready" as const, selected: false, progress: 0.1 },
    ];
    const { rerender } = render(<AssistModelPicker language="ja" disabled={false}
      modelId="system" models={models} />);
    fireEvent.click(screen.getByRole("button", { name: /モデルを選択/ }));
    const core = screen.getByRole("menuitemradio", { name: "Core" });
    core.focus();

    rerender(<AssistModelPicker language="ja" disabled={false} modelId="system"
      models={models.map((model) => model.id === "core" ? { ...model, progress: 0.7 } : model)} />);
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "Core" }));
  });

  it("relocates focus only when the focused model becomes unavailable", () => {
    const models = [
      { id: "system", displayName: "System", kind: "system" as const, status: "ready" as const, selected: true },
      { id: "core", displayName: "Core", kind: "core_ai" as const, status: "ready" as const, selected: false },
    ];
    const { rerender } = render(<AssistModelPicker language="ja" disabled={false}
      modelId="system" models={models} />);
    fireEvent.click(screen.getByRole("button", { name: /モデルを選択/ }));
    screen.getByRole("menuitemradio", { name: "Core" }).focus();

    rerender(<AssistModelPicker language="ja" disabled={false} modelId="system"
      models={models.map((model) => model.id === "core" ? { ...model, status: "paused" as const } : model)} />);
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "System" }));
  });
});
