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
export const AUTO_BACKUP_USER_CHOICE_STORAGE_KEY =
  "hazakura-note-auto-backup-user-choice";
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
export const MENU_LOCAL_DATA_DISCLOSURE = "local-data-disclosure";
export const MENU_OPEN_SUPPORT_DIAGNOSTICS = "open-support-diagnostics";
export const MENU_PRIVACY_POLICY = "privacy-policy";
export const MENU_OPEN_SOURCE_ACKNOWLEDGEMENTS =
  "open-source-acknowledgements";
export const MENU_ABOUT_HELP = "about-help";
export const MENU_QUIT_APP = "quit-app";
export const MENU_EXPORT_EPUB_BETA = "export-epub-beta";
export const AGENT_WORKBENCH_MAX_OUTPUT_CHUNKS = 500;
export const AGENT_WORKBENCH_SESSION_POLL_MS = 200;
export const EXTERNAL_CHANGE_ACTIVE_POLL_MS = 1000;
export const MAX_RESTORED_TABS = 12;
export const MAX_STORED_DRAFTS = 20;
export const MAX_RECENT_ITEMS = 8;
export const SCROLL_SYNC_TOLERANCE_PX = 10;
// v0.34: 慣性スクロール中の editor→preview 書き戻しとの衝突を防ぐため、
// preview 発スクロールのガードを解除するまでの待機時間。トラックパッド慣性
// スクロールのフレーム間隔（約16ms）より十分長く、かつ慣性停止後の切り替え
// が鈍くならない値として 150ms に設定。syncEditorScroll が連続発火する間は
// このタイマーが自己延長されるため、慣性継続中はガードが維持される。
export const SCROLL_SYNC_GUARD_RELEASE_MS = 150;
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
  | "edohigan"
  | "yakou"
  | "shokou"
  | "crt"
  | "shinkai";

export type ResolvedTheme =
  | BaseTheme
  | "edohigan"
  | "yakou"
  | "shokou"
  | "crt"
  | "shinkai";

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

export type RightPaneMode = "preview" | "compare" | "outline" | "ebook";

export type MenuLanguage = "en" | "ja" | "kana";

export function isJapaneseMenuLanguage(language: MenuLanguage): boolean {
  return language === "ja" || language === "kana";
}

export type HelpDocumentDialogMode =
  | "privacy"
  | "diagnostics"
  | "privacy-policy"
  | "open-source-acknowledgements"
  | "about";

export type PreferencesDialogMode =
  | "settings"
  | "agent"
  | HelpDocumentDialogMode;

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
export const MENU_IMPORT_PDF_IMAGE = "import-pdf-image";

export const MENU_OPEN_AGENT_WINDOW = "open-agent-window";

// Mirror of the Rust MENU_OPEN_APPLE_ASSIST_WINDOW constant. See
// src-tauri/src/types.rs and docs/apple-local-assist-writing-companion-plan.md.
// The Hazakura Local Assist window is the v0.12+ Writing Companion mock and
// lives in the same outside-companion slot as the Agent window.
export const MENU_OPEN_APPLE_ASSIST_WINDOW = "open-apple-assist-window";

// Mirror of the Rust APPLY_AI_EDIT_TRANSACTION_EVENT /
// REQUEST_AI_EDIT_TARGET_EVENT / AI_EDIT_TARGET_RESULT_EVENT
// constants. The Hazakura Local Assist window emits
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
// inferred Hazakura Local Assist target moves (selection change,
// cursor move, document switch); the detached Hazakura Local Assist
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
   * Per-request id generated by the Hazakura Local Assist window.
   * Status and streaming events must echo this id so the detached
   * window can ignore stale partial / completed messages.
   */
  requestId: string;
  /**
   * Internal fixed action id. UI labels and free-form text do
   * not become system instructions; the receiver maps this id
   * to a bounded operation.
   */
  actionId?: string;
  /**
   * Visible user-authored request text for the current request.
   * The field name is kept for IPC compatibility; treat the
   * value as prompt data, not system instruction.
   */
  additionalRequest?: string;
  /**
   * Whether the generated result may be applied to the active
   * document buffer. Current Local Assist presets use the same
   * diff-review document flow.
   */
  shouldApplyToDocument?: boolean;
  /**
   * User-facing request label for status, feedback, and AI edit
   * transaction display. This is display copy, not the
   * helper-side instruction.
   */
  request: string;
  /** Legacy helper-side request text, kept only for old callers. */
  instruction?: string;
  requestedAtMs: number;
  target: AppleAssistTargetSnapshot | null;
};

export type AppleAssistApplyStatusEvent = {
  // "cancelled" is emitted when the user stops an in-flight
  // generation (cancel UI or window/tab close). It clears the
  // busy state without applying any partial result.
  phase: "started" | "partial" | "completed" | "failed" | "cancelled";
  requestId: string;
  message: string;
  request: string;
  partialText?: string;
  shouldApplyToDocument?: boolean;
  emittedAtMs: number;
};

export type AppleAssistGenerationLock = {
  requestId: string;
  tabId: string;
  tabPath: string;
  request: string;
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

// v0.17 app-store-quality: save-restore-regression slice 1.4.
// Mirror of the Rust `APP_EXIT_REQUESTED_EVENT` constant. The
// normal macOS Quit item is custom-routed through `MENU_QUIT_APP`
// so Cmd+Q reaches the frontend dirty-state guard first. This
// event remains the fallback for OS-driven app exits that bypass
// the custom menu item: Rust catches `RunEvent::ExitRequested`,
// calls `api.prevent_exit()`, and emits this event to the main
// window. See src-tauri/src/types.rs.
export const APP_EXIT_REQUESTED_EVENT =
  "hazakura-note://app-exit-requested";

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
  // Lifetime identity of the open editor session, independent of the
  // document path. `id` stays equal to `path` so rename / move / external
  // refresh can keep matching on `id === path`, while `sessionId` lets
  // Save As preserve CodeMirror history / selection across a path change.
  sessionId: string;
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
  workspaceRootBookmark?: number[] | null;
  tabPaths: string[];
  tabFileBookmarks?: Record<string, number[]>;
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
  // Per-surface font size in px. Each surface reads its own
  // value through a `:root` CSS custom property
  // (`--editor-font-size` / `--preview-font-size` /
  // `--workspace-font-size` / `--lmode-font-size`) so the
  // editor pane, preview, file tree, and L Mode surface can
  // scale independently. Defaults preserve the historical
  // 14 / 15 / 13 / 15px values so existing users see no
  // visual change on first launch after upgrade.
  editorFontSize: number;
  previewFontSize: number;
  workspaceFontSize: number;
  lModeFontSize: number;
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
  // When Hazakura Local Assist changes the buffer, open the compact inline
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
    // v0.12+ Hazakura Local Assist Writing Companion (slice 5).
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
  // Stale detection snapshot for buffer-backed scopes
  // (`buffer-vs-disk`, `backup-vs-buffer`). Captured when the diff is
  // built so the view can warn when the buffer changed by another
  // path after capture. Fixed-snapshot scopes leave this unset.
  capturedSnapshot?: ChangeReviewSnapshot;
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

// Stale-detection snapshot for buffer-backed change-review scopes.
// Captured when the diff is built so the view can warn when the
// buffer changed by another path after capture. See
// `features/diff/changeReviewStale.ts`.
export type ChangeReviewSnapshot = {
  tabId: string;
  sessionId: string;
  contents: string;
  lineEnding: string;
  encoding: string;
  dirty: boolean;
};
