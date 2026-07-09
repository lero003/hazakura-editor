import type { AppleAssistGenerationLock } from "../../types";

/**
 * Q-STR-2 — single gate for "may this tab's buffer be mutated while
 * Hazakura Local Assist is generating?"
 *
 * Lock identity uses `tabId` OR `tabPath` (generation may rekey path while
 * the same logical document is locked). Callers must not invent a third
 * ad-hoc check.
 */
export const APPLE_ASSIST_TAB_LOCKED_STATUS_MESSAGE =
  "生成中のため、この文書の編集を一時停止しています";

export type TabIdentity = {
  id?: string | null;
  path?: string | null;
};

export type TabEditability =
  | { editable: true }
  | {
      editable: false;
      reason: "apple-assist-generating";
      statusMessage: string;
    };

export function isAppleAssistTabLocked(
  lock: AppleAssistGenerationLock | null | undefined,
  tabId: string | null | undefined,
  tabPath: string | null | undefined,
): boolean {
  if (!lock) {
    return false;
  }
  return (
    (Boolean(tabId) && lock.tabId === tabId) ||
    (Boolean(tabPath) && lock.tabPath === tabPath)
  );
}

export function assertTabEditable(
  lock: AppleAssistGenerationLock | null | undefined,
  tab: TabIdentity | null | undefined,
): TabEditability {
  if (!tab) {
    return { editable: true };
  }
  if (isAppleAssistTabLocked(lock, tab.id, tab.path)) {
    return {
      editable: false,
      reason: "apple-assist-generating",
      statusMessage: APPLE_ASSIST_TAB_LOCKED_STATUS_MESSAGE,
    };
  }
  return { editable: true };
}
