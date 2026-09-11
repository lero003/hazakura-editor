import type { BaseTheme } from "../../types";

/**
 * 窓の OS 外観（macOS の appearance）。
 *
 * 窓の外観を変えると macOS は**タイトルバーを組み直す**。そのとき
 * `src-tauri/tauri.conf.json` の `trafficLightPosition` が失われ、信号機は
 * システム既定の位置へ戻る。実機で「起動直後とテーマ切替後で信号機の位置がズレる」と
 * 報告された現象はこれで説明できる（ネイティブ側を動かすコードは無い。
 * 位置はウィンドウ生成時に一度だけ効く）。
 *
 * Tauri 2.11 の公開APIは**ウィンドウ生成時**にしか位置を設定できない
 * （`set_traffic_light_position` は tauri の公開面に無い。ビルダーのみ）。
 * そのため、ここでは**不要な外観変更を減らす**方針を取る:
 *
 * - 生成時の設定（`tauri.conf.json` の `app.windows[0].theme`）と同じ外観なら呼ばない。
 *   → 既定の起動では窓の外観を触らないので、信号機は設定位置のまま。
 * - 同じ基調のテーマ間（例: 森の夜 → CRT 深層）でも呼ばない。
 *   → 見た目は CSS が担うので、OS の外観を変える必要が無い。
 *
 * 残るのは「明 ↔ 暗」をまたぐ切替の1回だけ。ここは窓の外観を変える必要があり、
 * 位置を再適用する公開APIが無いため、位置が既定へ戻り得る（docs に明記）。
 */
export const WINDOW_CONFIG_THEME: BaseTheme = "dark";

let appliedWindowTheme: BaseTheme | null = WINDOW_CONFIG_THEME;

/** 実際に窓の外観を変える必要があるか。 */
export function shouldApplyWindowTheme(next: BaseTheme): boolean {
  return next !== appliedWindowTheme;
}

/**
 * 窓の外観を適用する。**変える必要があるときだけ** `apply` を呼び、適用済みを更新する。
 * @returns 適用した（= 組み直しが起き得る）なら true
 */
export function applyWindowTheme(
  next: BaseTheme,
  apply: (theme: BaseTheme) => void,
): boolean {
  if (!shouldApplyWindowTheme(next)) {
    return false;
  }
  appliedWindowTheme = next;
  apply(next);
  return true;
}

/** テスト用。窓の外観は生成時の設定から始まる。 */
export function resetAppliedWindowThemeForTests(): void {
  appliedWindowTheme = WINDOW_CONFIG_THEME;
}
