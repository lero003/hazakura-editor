import type { EditorTab } from "../../types";

/**
 * Typing may continue during a disk read. A save, reopen, rename, or conflict
 * decision invalidates its baseline; those operations own the newer state.
 */
export function hasSameDocumentIoBaseline(candidate: EditorTab, original: EditorTab): boolean {
  return candidate.id === original.id &&
    candidate.sessionId === original.sessionId &&
    candidate.path === original.path &&
    candidate.fingerprint === original.fingerprint &&
    candidate.lastSavedContents === original.lastSavedContents &&
    candidate.lastSavedEncoding === original.lastSavedEncoding &&
    candidate.lastSavedLineEnding === original.lastSavedLineEnding &&
    // The saved indicator becomes idle on the next keystroke without
    // changing the disk baseline. Treat that as continued editing.
    (candidate.saveStatus === original.saveStatus ||
      (original.saveStatus === "saved" && candidate.saveStatus === "idle")) &&
    candidate.ignoredExternalFingerprint === original.ignoredExternalFingerprint &&
    candidate.externalFingerprint === original.externalFingerprint;
}
