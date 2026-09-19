import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MENU_LANGUAGE_STORAGE_KEY } from "./types";

// エントリの順序そのものを固定する: `<html lang>` は React の初回描画より前に
// 保存済み表示言語へ揃っていなければならない（cold launch の `lang=en` を防ぐ）。
const { createRootMock, renderMock } = vi.hoisted(() => ({
  createRootMock: vi.fn(),
  renderMock: vi.fn(),
}));

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}));

let languageAtFirstRender: string | null = null;

describe("app entry document language", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
    document.body.innerHTML = '<div id="root"></div>';
    languageAtFirstRender = null;
    createRootMock.mockReset();
    createRootMock.mockImplementation(() => ({ render: renderMock }));
    renderMock.mockReset();
    renderMock.mockImplementation(() => {
      languageAtFirstRender = document.documentElement.lang;
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    document.documentElement.lang = "";
  });

  it("sets <html lang> from storage before the main window renders", async () => {
    window.localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, "ja");

    await import("./main");

    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(languageAtFirstRender).toBe("ja");
  });

  it("sets <html lang> from storage before the Local Assist window renders", async () => {
    window.localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, "kana");

    await import("./appleAssistEntry");

    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(languageAtFirstRender).toBe("ja");
  });

  it("sets <html lang> from storage before the Agent window renders", async () => {
    window.localStorage.setItem(MENU_LANGUAGE_STORAGE_KEY, "ja");

    await import("./agentEntry");

    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);
    expect(languageAtFirstRender).toBe("ja");
  });
});
