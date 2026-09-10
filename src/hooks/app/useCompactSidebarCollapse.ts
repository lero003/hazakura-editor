import { useCallback, useEffect, useState } from "react";
import {
  COMPACT_SIDEBAR_MAX_WIDTH,
  nextSidebarOverride,
  resolveSidebarCollapsed,
} from "../../features/workspace/compactSidebar";

/**
 * 幅のメディアクエリを購読する。SSR / jsdom のように `matchMedia` が無い環境では
 * false（＝広い幅の既定）を返し、レイアウトを勝手に変えない。
 */
function useMaxWidthMatch(maxWidth: number): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener?.("change", sync);
    return () => list.removeEventListener?.("change", sync);
  }, [query]);

  return matches;
}

/**
 * 狭い窓ではサイドバーを一時的に畳む。保存された設定は持たず、明示選択も
 * 幅が変わるまでしか効かない（モック23の指示6：表示上の一時的な折畳みと
 * 利用者設定を分ける）。
 */
export function useCompactSidebarCollapse(): {
  collapsed: boolean;
  compactWidth: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
} {
  const compactWidth = useMaxWidthMatch(COMPACT_SIDEBAR_MAX_WIDTH);
  const [userOverride, setUserOverride] = useState<boolean | null>(null);

  // 幅が変わったら明示選択を解除し、その幅の既定へ戻す。
  useEffect(() => {
    setUserOverride(null);
  }, [compactWidth]);

  const toggle = useCallback(() => {
    setUserOverride((previous) => nextSidebarOverride(previous, compactWidth));
  }, [compactWidth]);

  const setCollapsed = useCallback((collapsed: boolean) => {
    setUserOverride(collapsed);
  }, []);

  return {
    collapsed: resolveSidebarCollapsed(userOverride, compactWidth),
    compactWidth,
    toggle,
    setCollapsed,
  };
}
