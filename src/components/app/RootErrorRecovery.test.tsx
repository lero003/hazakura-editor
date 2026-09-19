import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RootErrorRecovery } from "./RootErrorRecovery";

function BrokenApp(): never {
  throw new Error("renderer failed");
}

function FalsyBrokenApp(): never {
  throw null;
}

afterEach(() => {
  cleanup();
  document.documentElement.lang = "";
  vi.restoreAllMocks();
});

describe("RootErrorRecovery", () => {
  it("uses English recovery copy when the app chrome is English", () => {
    document.documentElement.lang = "en";
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <RootErrorRecovery>
        <BrokenApp />
      </RootErrorRecovery>,
    );

    expect(
      screen.getByRole("heading", { name: "Editing session protected" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reload app" })).toBeTruthy();
    expect(screen.queryByText("編集セッションを保護しています")).toBeNull();
    expect(screen.getByText("renderer failed").getAttribute("lang")).toBe("");
  });

  it("uses Japanese recovery copy when the app chrome is Japanese", () => {
    document.documentElement.lang = "ja";
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <RootErrorRecovery>
        <BrokenApp />
      </RootErrorRecovery>,
    );

    expect(
      screen.getByRole("heading", { name: "編集セッションを保護しています" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "アプリを再読み込み" }),
    ).toBeTruthy();
    expect(screen.queryByText("Editing session protected.")).toBeNull();
  });

  it("keeps the recovery surface available when a child throws a falsy value", () => {
    document.documentElement.lang = "en";
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <RootErrorRecovery>
        <FalsyBrokenApp />
      </RootErrorRecovery>,
    );

    expect(
      screen.getByRole("heading", { name: "Editing session protected" }),
    ).toBeTruthy();
    expect(screen.getByText("Unknown error").getAttribute("lang")).toBe("");
  });
});
