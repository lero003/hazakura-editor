import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppleAssistWindowApp } from "./AppleAssistWindowApp";

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => vi.fn()),
}));

vi.mock("../../lib/tauri", async () => {
  const actual = await vi.importActual<typeof import("../../lib/tauri")>(
    "../../lib/tauri",
  );
  return {
    ...actual,
    getMainAppleAssistTarget: vi.fn(async () => null),
    requestApplyAiEditTransaction: vi.fn(async () => undefined),
    setAppleAssistWindowTheme: vi.fn(async () => undefined),
  };
});

vi.mock("../../hooks/agent/useAppleAssistAvailability", () => ({
  useAppleAssistAvailability: () => ({
    availability: { kind: "available" },
    available: true,
    probed: true,
  }),
}));

afterEach(() => {
  cleanup();
});

describe("AppleAssistWindowApp render", () => {
  it("does not repeat the Hazakura Local Assist title inside the window body", () => {
    render(<AppleAssistWindowApp />);

    expect(screen.getByTestId("apple-assist-shell")).toBeTruthy();
    expect(
      document.querySelector(".apple-assist-window-title"),
    ).toBeNull();
  });
});
