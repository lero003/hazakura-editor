import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyWindowTheme,
  resetAppliedWindowThemeForTests,
  shouldApplyWindowTheme,
  WINDOW_CONFIG_THEME,
} from "./windowAppearance";

describe("windowAppearance", () => {
  beforeEach(() => {
    resetAppliedWindowThemeForTests();
  });

  it("does not touch the window appearance when it already matches the config", () => {
    // 実機指摘: 起動直後に信号機がズレる。窓の外観を変えると macOS がタイトルバーを
    // 組み直し、tauri.conf.json の trafficLightPosition が失われる。
    // 生成時の設定と同じ外観なら触らない（= 既定の起動では組み直しが起きない）。
    const apply = vi.fn();
    expect(applyWindowTheme(WINDOW_CONFIG_THEME, apply)).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(shouldApplyWindowTheme(WINDOW_CONFIG_THEME)).toBe(false);
  });

  it("applies only when the base appearance actually changes", () => {
    // 同じ基調のテーマ間（森の夜 → CRT）では呼ばない = 組み直しを避ける。
    const apply = vi.fn();
    expect(applyWindowTheme("dark", apply)).toBe(false);
    expect(applyWindowTheme("dark", apply)).toBe(false);
    expect(apply).not.toHaveBeenCalled();

    // 明 ↔ 暗をまたぐときは必要（窓の外観を合わせる）。
    expect(applyWindowTheme("light", apply)).toBe(true);
    expect(apply).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledWith("light");

    // 元へ戻すのも1回だけ。
    expect(applyWindowTheme("light", apply)).toBe(false);
    expect(applyWindowTheme("dark", apply)).toBe(true);
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it("keeps the config theme constant in sync with tauri.conf.json", () => {
    // 定数と設定がずれると「起動時に組み直しが起きる」判定を誤る。
    const conf = JSON.parse(
      readFileSync(`${process.cwd()}/src-tauri/tauri.conf.json`, "utf8"),
    ) as { app?: { windows?: Array<{ theme?: string }> } };
    // Tauri の config は "Dark"（先頭大文字）、BaseTheme は小文字。
    expect(conf.app?.windows?.[0]?.theme?.toLowerCase()).toBe(WINDOW_CONFIG_THEME);
  });
});
