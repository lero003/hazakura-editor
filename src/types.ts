import type {
  AgentWorkbenchPreflight,
  AgentWorkbenchProvider,
  TextFileDocument,
} from "./lib/tauri";

// ── Storage Keys (Safe Editor) ──

export const THEME_STORAGE_KEY = "hazakura-note-theme";
export const WORKSPACE_STATE_STORAGE_KEY = "hazakura-note-workspace-state";
export const PREVIEW_VISIBLE_STORAGE_KEY = "hazakura-note-preview-visible";
export const EDITOR_SETTINGS_STORAGE_KEY = "hazakura-note-editor-settings";
export const MENU_LANGUAGE_STORAGE_KEY = "hazakura-note-menu-language";
export const DRAFT_STATE_STORAGE_KEY = "hazakura-note-unsaved-drafts";
export const RECENT_FILES_STORAGE_KEY = "hazakura-note-recent-files";
export const RECENT_FOLDERS_STORAGE_KEY = "hazakura-note-recent-folders";

// ── Storage Keys (Assist Surface: Agent Workbench) ──
// See docs/assist-surface-strategy.md and docs/agent-workbench-boundary.md.

export const AGENT_WORKBENCH_ENABLED_STORAGE_KEY =
  "hazakura-note-agent-workbench-enabled";
export const AGENT_WORKBENCH_CONSENT_STORAGE_KEY =
  "hazakura-note-agent-workbench-consent";
export const AGENT_WORKBENCH_PROVIDER_STORAGE_KEY =
  "hazakura-note-agent-workbench-provider";
export const ASSIST_SURFACE_PREFERENCE_STORAGE_KEY =
  "hazakura-note-assist-surface";

// ── App Constants ──

export const APP_MENU_ACTION_EVENT = "hazakura-note://menu-action";
export const AGENT_WORKBENCH_MAX_OUTPUT_CHUNKS = 500;
export const AGENT_WORKBENCH_SESSION_POLL_MS = 200;
export const EXTERNAL_CHANGE_ACTIVE_POLL_MS = 1000;
export const MAX_RESTORED_TABS = 12;
export const MAX_STORED_DRAFTS = 20;
export const MAX_RECENT_ITEMS = 8;
export const SCROLL_SYNC_TOLERANCE_PX = 10;
export const DEFAULT_PREVIEW_COLUMN_PERCENT = 42;
export const MIN_PREVIEW_COLUMN_PERCENT = 25;
export const MAX_PREVIEW_COLUMN_PERCENT = 75;
export const DIFF_MAX_LINE_PRODUCT = 4_000_000;
export const MARKDOWN_OUTLINE_MAX_HEADINGS = 200;

export const EXTERNAL_CHANGE_CONFLICT_MESSAGE =
  "The file changed on disk, possibly from another app or Agent provider. Saving is stopped until you choose how to continue.";

export const AGENT_WORKBENCH_PROVIDERS: Array<{
  id: AgentWorkbenchProvider;
  label: string;
}> = [
  { id: "codex", label: "Codex CLI" },
  { id: "opencode", label: "OpenCode CLI" },
  { id: "pi", label: "Pi CLI" },
  { id: "claude", label: "Claude Code CLI" },
];

// ── Core Types ──

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "conflict";

export type BaseTheme = "light" | "dark";

export type ThemePreference =
  | BaseTheme
  | "sakura"
  | "yakou"
  | "shokou";

export type ResolvedTheme =
  | BaseTheme
  | "sakura"
  | "yakou"
  | "shokou";

export type EditableLineEnding = "lf" | "crlf";

export type LineEndingKind = EditableLineEnding | "mixed" | "none";

// Text encoding is the byte-level encoding of the file on disk. The
// editor currently supports a narrow set: UTF-8 (the default for new
// files), UTF-8 with a leading BOM, Windows Shift-JIS, and EUC-JP. The
// in-memory buffer is always a JS string (UTF-16 internally), so the
// encoding is only meaningful at read / save time. See
// src-tauri/src/util.rs (detect_text_encoding, encode_text,
// decode_text_bytes) and src/components/app/StatusBar.tsx (the
// encoding selector chip).
export type TextEncoding = "utf-8" | "utf-8-bom" | "shift-jis" | "euc-jp";

export type RightPaneMode = "preview" | "compare" | "outline";

// Review Desk is a top-level review surface that intentionally replaces
// the editor area when open, separate from RightPaneMode which lives
// next to the editor. See docs/archive/reviews/v0.7-review-desk-design-decisions.md
// (B-1) and docs/archive/reviews/v0.7-readiness-gate.md (R-1).
export type ReviewSurface = "review" | null;

// Review Desk internal surface mode. Today only the empty state is
// reachable; future slices will add the AI candidate / change review
// / draft review / conflict review modes through the same enum. See
// docs/archive/reviews/v0.7-review-desk-design-decisions.md (R-4).
export type ReviewDeskMode = "empty";

export type MenuLanguage = "en" | "ja" | "kana";

export function isJapaneseMenuLanguage(language: MenuLanguage): boolean {
  return language === "ja" || language === "kana";
}

export type PreferencesDialogMode = "settings" | "agent";

export type AssistSurfacePreference =
  | "none"
  | "apple-local"
  | "external-cli";

// ── Document Types ──

export type MarkdownHeading = {
  level: number;
  line: number;
  text: string;
};

export type MarkdownOutline = {
  headings: MarkdownHeading[];
  truncated: boolean;
};

export type MarkdownHeadingContext = {
  previous: MarkdownHeading | null;
  current: MarkdownHeading | null;
  next: MarkdownHeading | null;
};

// ── Agent Types ──

// Mirror of the Rust MENU_OPEN_AGENT_WINDOW constant. See
// src-tauri/src/types.rs and docs/assist-surface-strategy.md.
export const MENU_OPEN_AGENT_WINDOW = "open-agent-window";

// Mirror of the Rust MENU_OPEN_APPLE_ASSIST_WINDOW constant. See
// src-tauri/src/types.rs and docs/apple-local-assist-writing-companion-plan.md.
// The Apple Assist window is the v0.12+ Writing Companion mock and
// lives in the same outside-companion slot as the Agent window.
export const MENU_OPEN_APPLE_ASSIST_WINDOW = "open-apple-assist-window";

// Mirror of the Rust APPLY_AI_EDIT_TRANSACTION_EVENT /
// REQUEST_AI_EDIT_TARGET_EVENT / AI_EDIT_TARGET_RESULT_EVENT
// constants. The Apple Assist window emits
// `APPLY_AI_EDIT_TRANSACTION_EVENT` to ask the main window to
// apply an AI edit transaction; the main window answers the
// `REQUEST_AI_EDIT_TARGET_EVENT` round-trip with a bounded
// target via `AI_EDIT_TARGET_RESULT_EVENT`. See
// src-tauri/src/types.rs and
// docs/apple-local-assist-writing-companion-plan.md.
export const APPLY_AI_EDIT_TRANSACTION_EVENT =
  "hazakura-note://apply-ai-edit-transaction";
export const APPLE_ASSIST_APPLY_STATUS_EVENT =
  "hazakura-note://apple-assist-apply-status";
export const REQUEST_AI_EDIT_TARGET_EVENT =
  "hazakura-note://request-ai-edit-target";
export const AI_EDIT_TARGET_RESULT_EVENT =
  "hazakura-note://ai-edit-target-result";

// Mirror of the Rust MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT
// constant. The main window broadcasts this whenever the
// inferred Apple Assist target moves (selection change,
// cursor move, document switch); the detached Apple Assist
// window subscribes to keep its target panel live.
export const MAIN_APPLE_ASSIST_TARGET_CHANGED_EVENT =
  "hazakura-note://main-apple-assist-target-changed";

// Bounded AI edit target snapshot. Mirrors the Rust
// `AppleAssistTargetSnapshot` in
// `src-tauri/src/commands/apple_assist_target.rs`. The main
// window infers the target from the CodeMirror state via
// `inferAppleAssistTarget` and pushes it here on every
// selection / cursor change.
export type AppleAssistTargetKind =
  | "selection"
  | "paragraph"
  | "block"
  | "section"
  | "document";

export type AppleAssistTargetSnapshot = {
  kind: AppleAssistTargetKind;
  start: number;
  end: number;
  text: string;
  label: string;
  activeDocumentPath: string | null;
  activeDocumentName: string | null;
  capturedAtMs: number;
};

export type AppleAssistApplyEvent = {
  /**
   * The original rough request as shown in the textarea, the
   * AI edit transaction, the main editor status message, and
   * the Apple Assist review bar. This is the value the user
   * actually sees end-to-end and is *not* the helper-side
   * instruction.
   */
  request: string;
  /**
   * Optional helper-side instruction. When omitted, the
   * receiver falls back to `request`. v0.15+ callers that
   * annotate the rough request with a preset intent hint
   * (see `buildAssistantInstruction` in
   * `src/lib/appleAssist/instruction.ts`) should pass the
   * annotated value here while keeping `request` set to the
   * original phrase, so the helper sees a clearer intent
   * label while the user-facing surfaces keep showing
   * exactly what the user typed.
   */
  instruction?: string;
  requestedAtMs: number;
  target: AppleAssistTargetSnapshot | null;
};

export type AppleAssistApplyStatusEvent = {
  phase: "started" | "completed" | "failed";
  message: string;
  request: string;
  emittedAtMs: number;
};

// Mirror of the Rust OPEN_MAIN_AGENT_PANE_EVENT constant. The detached
// Agent window can emit this when the user clicks the footer's
// "Show in main pane" affordance. As of the v0.8+ slice the right
// pane no longer hosts the Agent (the detached window is the only
// surface), so the main window no longer listens for this event;
// the constant is kept for compatibility with the agent window's
// reverse-link button, which the v0.8+ slice removes. See
// src-tauri/src/types.rs and docs/assist-surface-strategy.md.
export const OPEN_MAIN_AGENT_PANE_EVENT =
  "hazakura-note://open-main-agent-pane";

// Mirror of the Rust MAIN_WORKSPACE_CHANGED_EVENT constant. The main
// window emits this when the active workspace opens / closes; the
// detached Agent window subscribes to learn the active workspace
// path without depending on the main window being alive. See
// src-tauri/src/types.rs and docs/assist-surface-strategy.md.
export const MAIN_WORKSPACE_CHANGED_EVENT =
  "hazakura-note://main-workspace-changed";

export type AgentLaunchGateState = {
  kind: "idle" | "checking" | "passed" | "rejected";
  message: string;
  preflight: AgentWorkbenchPreflight | null;
};

export type AgentTerminalSize = {
  columns: number;
  rows: number;
};

// ── Editor Types ──

export type EditorTab = TextFileDocument & {
  id: string;
  contents: string;
  lastSavedContents: string;
  lastSavedLineEnding: EditableLineEnding;
  lastSavedEncoding: TextEncoding;
  ignoredExternalFingerprint: string | null;
  externalFingerprint: string | null;
  saveStatus: SaveStatus;
  error: string | null;
};

export type PersistedWorkspaceState = {
  workspaceRootPath: string | null;
  tabPaths: string[];
  activeTabPath: string | null;
};

export type TextMatch = {
  from: number;
  to: number;
};

export type SearchOptions = {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
};

export type EditorSettings = {
  wrapLines: boolean;
  showInvisibles: boolean;
  fontSize: number;
  tabSize: number;
  spellcheckEnabled: boolean;
  autoBackupEnabled: boolean;
  ambientIntensity: AmbientIntensity;
  // Experimental one-pane reading-writing mode. Hides workspace
  // chrome, suppresses Markdown markers in inactive lines, and
  // applies page-like typography. Source text is never modified.
  lModeEnabled: boolean;
  // Typewriter mode: when on, the active line is kept vertically
  // centered as the cursor moves. Off by default — many writers
  // find it disorienting, and the default top-anchored flow is
  // what most editors do.
  lModeTypewriter: boolean;
  // When Apple Assist changes the buffer, open the compact inline
  // diff by default so the edit is immediately visible. Users can
  // turn this off when the bar feels too large for their workflow.
  appleAssistDiffInitiallyOpen: boolean;
};

export type AmbientIntensity = "off" | "subtle" | "normal" | "dramatic";

export type DraftRecord = {
  path: string;
  contents: string;
  line_ending: EditableLineEnding;
  savedFingerprint: string;
  updatedAt: number;
};

export type RecentEntry = {
  path: string;
  label: string;
  openedAt: number;
  // `pinnedAt` is a non-null timestamp when the user has pinned
  // this entry to the top of the start panel. Pinned entries
  // are not subject to the FIFO recency cap so a daily note
  // the user returns to often can sit at the top indefinitely.
  // `null` is the default for entries that have never been
  // pinned and for entries written by an older build that did
  // not know about the field.
  pinnedAt: number | null;
};

export type TextDocumentStats = {
  bytes: number;
  characters: number;
  lineEnding: LineEndingKind;
  hasFinalNewline: boolean;
};

export type ImagePreviewState = {
  path: string;
  name: string;
  url: string;
  size: number;
};

// ── Compare / Diff Types ──

export type CompareAnchor = {
  path: string;
  name: string;
};

export type WorkspaceContextMenuEntryKind = "file" | "directory" | "root";

export type WorkspaceContextMenuState = CompareAnchor & {
  x: number;
  y: number;
  canCompare: boolean;
  kind: WorkspaceContextMenuEntryKind;
};

export type DiffLine = {
  kind: "equal" | "added" | "removed";
  leftLine: number | null;
  rightLine: number | null;
  text: string;
};

export type DiffSplitCell = {
  kind: "equal" | "added" | "removed" | "blank";
  line: number | null;
  text: string;
};

export type DiffSplitRow = {
  kind: "equal" | "added" | "removed" | "changed";
  left: DiffSplitCell;
  right: DiffSplitCell;
};

export type DiffDisplayRow =
  | {
      kind: "section";
      key: string;
      label: string;
    }
  | {
      kind: "line";
      key: string;
      row: DiffSplitRow;
    };

export type CompareCase = {
  kind: "file";
  key: string;
  leftPath: string;
  rightPath: string;
  anchor: { path: string; name: string; label: string };
  target: { path: string; name: string; label: string };
} | {
  kind: "changes";
  key: string;
  scope:
    | "buffer-vs-disk"
    | "draft-vs-disk"
    | "conflict-vs-disk"
    | "backup-vs-buffer"
    // v0.12+ Apple Local Assist Writing Companion (slice 5).
    // The escape hatch renders an inline diff of a pending
    // AI edit transaction (`before` -> `after`) using the
    // existing `DiffBody` pipeline; the synthetic case
    // scopes the right column to the AI-suggested text and
    // leaves `backupApplyAction` unset because AI edits
    // are reverted through a separate `Discard` button on
    // the `AppleAssistReviewBar`, not through the
    // right-pane apply-backup flow.
    | "ai-edit-vs-buffer";
  documentPath: string;
  documentLabel: string;
  leftColumnLabel: string;
  rightColumnLabel: string;
  // `backupApplyAction` is set only for the auto-backup restore
  // scope; the right-pane view renders a single apply button that
  // re-writes the active tab contents to the backup snapshot. Other
  // scopes (disk / draft / conflict) are read-only diffs and leave
  // the field unset.
  backupApplyAction?: {
    backupName: string;
    backupContents: string;
  };
} | {
  // Manual candidate paste review: the right column is a
  // user-typed candidate snapshot, never a path on disk. The
  // left column is the active buffer. See R-4 manual candidate
  // MVP in docs/archive/reviews/v0.7-review-desk-design-decisions.md.
  kind: "candidate";
  key: string;
  documentTabId: string;
  documentContents: string;
  documentPath: string;
  documentLabel: string;
  leftColumnLabel: string;
  rightColumnLabel: string;
  candidateSourceLabel: string;
  candidateText: string;
  comparedAt: number;
};

export type CompareViewState = {
  caseKey: string;
  lines: DiffLine[];
  additions: number;
  removals: number;
};
