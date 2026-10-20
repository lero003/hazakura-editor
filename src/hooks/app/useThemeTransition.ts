import { useLayoutEffect, useRef } from "react";
import { useReducedMotion } from "./useReducedMotion";

/** 切替アニメーションの長さ（reduced-motion では短くする）。 */
export const THEME_SWITCH_MS = 200;
export const THEME_SWITCH_REDUCED_MS = 80;

/**
 * テーマ切替のクロスフェード / Theme switch crossfade.
 *
 * テーマの変更は React の state 更新で一度に起きるため、そのままだと
 * 面ごとに別々のタイミングで色が飛ぶ（一部は transition され、一部は瞬間）。
 * 切替の直後だけ `<html data-theme-switching="true">` を立て、
 * themes.css 側で「面の色・文字色・罫線・影」を短くトランジションさせる。
 * 属性は `useLayoutEffect` で描画前に立てる。`useEffect`（描画後）だと
 * 新しい色が先に描かれてから transition が有効になり、アニメーションが
 * 始まらないことがある。200ms で属性を外すので通常操作には影響しない。
 *
 * 背景のグラデーション（yakou / shokou）と WebGL canvas は CSS で
 * 補間できないため、このスライスではスナップしたままにする。
 * View Transitions は実機対応を確認してから別スライスで扱う。
 *
 * reduced-motion では 80ms の短いフェードに留める（動きを増やさない）。
 */
export function useThemeTransition(theme: string): void {
  const reducedMotion = useReducedMotion();
  const previousTheme = useRef(theme);

  useLayoutEffect(() => {
    if (previousTheme.current === theme) {
      return;
    }
    previousTheme.current = theme;
    const root = document.documentElement;
    root.dataset.themeSwitching = "true";
    const duration = reducedMotion
      ? THEME_SWITCH_REDUCED_MS
      : THEME_SWITCH_MS;
    const timer = window.setTimeout(() => {
      delete root.dataset.themeSwitching;
    }, duration);
    return () => {
      window.clearTimeout(timer);
      delete root.dataset.themeSwitching;
    };
  }, [theme, reducedMotion]);
}
