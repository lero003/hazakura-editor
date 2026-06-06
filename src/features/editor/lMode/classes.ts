// L Mode (えるモード) class catalog.
//
// This is the single source of truth for every CSS class the
// L Mode system touches. The CodeMirror extension, the widget
// implementations, the React chrome components, and the CSS
// drift test all reference the constants in this file. Raw
// class strings ("cm-lmode-...", "l-mode-...") should never
// appear anywhere else in the L Mode module.
//
// The catalog is split into four sections:
//
//   1. Line classes — applied via `Decoration.line` to drive
//      the visual rhythm of structural blocks (headings,
//      blockquotes, lists, fenced code, tables) and to mark
//      the active / dimmed lines.
//
//   2. Content / widget classes — applied via `Decoration.mark`
//      to inline ranges, or set on the DOM of a `WidgetType`
//      subclass.
//
//   3. Chrome classes — used by React components only (the
//      empty-document placeholder, the exit pill). They never
//      appear in the CodeMirror decoration set, but listing
//      them here lets the CSS drift test verify each one has
//      a corresponding rule in `src/styles/lMode.css`.
//
//   4. Catalog data — Lezer node-name → class-name rules for
//      the structural / inline / marker patterns, plus the
//      active-line chip label table. The extension code reads
//      these tables; the tables are the only place that
//      connects Lezer node names to L Mode classes, so adding
//      a new structural element is a one-edit change.

export const LModeClasses = {
  // --- 1. Line classes ---
  activeLine: "cm-lmode-source-line",
  dimmedLine: "cm-lmode-dimmed",

  heading1: "cm-lmode-heading-1",
  heading1First: "cm-lmode-heading-1-first",
  heading2: "cm-lmode-heading-2",
  heading3: "cm-lmode-heading-3",
  heading4: "cm-lmode-heading-4",
  heading5: "cm-lmode-heading-5",
  heading6: "cm-lmode-heading-6",

  blockquote: "cm-lmode-blockquote",

  list: "cm-lmode-list",
  listBullet: "cm-lmode-list-bullet",
  listOrdered: "cm-lmode-list-ordered",
  listOrderedStart: "cm-lmode-list-ordered-start",

  fencedCode: "cm-lmode-fenced-code",
  fencedCodeStart: "cm-lmode-fenced-code-start",
  fencedCodeEnd: "cm-lmode-fenced-code-end",

  tableHeader: "cm-lmode-table-header",
  tableRow: "cm-lmode-table-row",

  // --- 2. Content / widget classes ---
  hiddenMarker: "cm-lmode-hidden",
  pipe: "cm-lmode-pipe",
  emphasis: "cm-lmode-emphasis",
  strong: "cm-lmode-strong",
  strike: "cm-lmode-strike",
  link: "cm-lmode-link",

  image: "cm-lmode-image",
  imageCaption: "cm-lmode-image-caption",
  imagePlaceholder: "cm-lmode-image-placeholder",

  hr: "cm-lmode-hr",
  tableDelimiter: "cm-lmode-table-delimiter",

  task: "cm-lmode-task",
  taskUnchecked: "cm-lmode-task-unchecked",
  taskChecked: "cm-lmode-task-checked",

  // --- 3. Chrome classes ---
  emptyPlaceholder: "l-mode-empty-placeholder",
  emptyPlaceholderMark: "l-mode-empty-placeholder-mark",
  emptyPlaceholderText: "l-mode-empty-placeholder-text",
  emptyPlaceholderHint: "l-mode-empty-placeholder-hint",

  exitPill: "l-mode-exit-pill",
  exitPillMonogram: "l-mode-exit-pill-monogram",
  exitPillLabel: "l-mode-exit-pill-label",

  // Escape hatches surfaced as a small L Mode action rail.
  // They live behind the same `data-l-mode="on"` gate as the
  // exit pill, but stay visually separate from transient status
  // text so review/workspace commands do not read like status
  // copy. They are listed here so the CSS drift test can verify
  // each one has a rule.
  actionRail: "l-mode-action-rail",
  actionButton: "l-mode-action-button",

  // L Mode workspace drawer. The normal file tree remains
  // hidden by default; these classes drive the translucent
  // top-left affordance and the temporary drawer that reuses
  // the bounded WorkspaceSidebar.
  workspaceToggle: "l-mode-workspace-toggle",
  workspaceUnsavedDot: "l-mode-workspace-unsaved-dot",
  workspaceOverlay: "l-mode-workspace-overlay",
  workspaceBackdrop: "l-mode-workspace-backdrop",
  workspaceDrawer: "l-mode-workspace-drawer",

  // Local change review sheet. L Mode uses this transient
  // window instead of opening Safe Edit's right compare pane.
  changeReviewSheet: "l-mode-change-review-sheet",
  changeReviewHeader: "l-mode-change-review-header",
  changeReviewIcon: "l-mode-change-review-icon",
  changeReviewTitleGroup: "l-mode-change-review-title-group",
  changeReviewTitle: "l-mode-change-review-title",
  changeReviewMeta: "l-mode-change-review-meta",
  changeReviewCounts: "l-mode-change-review-counts",
  changeReviewCloseButton: "l-mode-change-review-close-button",
  changeReviewDiff: "l-mode-change-review-diff",
} as const;

export type LModeClassName = (typeof LModeClasses)[keyof typeof LModeClasses];

// --- 4. Catalog data ---

/**
 * A `BlockRule` attaches a line class (or classes) to every
 * line of a Lezer block node, or to its first / last line.
 *
 * `nodes` is the set of Lezer node names that trigger this
 * rule. The rule fires on ANY of them — most blocks have one
 * node, but if e.g. a future parser emits `SetextHeading1` and
 * `ATXHeading1` both, they'd share one rule.
 *
 * `all` attaches to every line of the block.
 * `first` attaches only to the line containing the block's
 *   start position.
 * `last` attaches only to the line containing the block's end
 *   position.
 *
 * A rule can set any combination of `all` / `first` / `last`,
 * including none of them (then it's a no-op — useful for
 * documenting that a node is recognized, with its styling
 * driven entirely by `LModeExtraLineClasses` or
 * `LModeInlineRules`).
 */
export type LModeBlockRule = {
  readonly nodes: readonly string[];
  readonly all?: string;
  readonly first?: string;
  readonly last?: string;
};

export const LModeBlockRules: readonly LModeBlockRule[] = [
  {
    nodes: ["ATXHeading1"],
    all: LModeClasses.heading1,
    first: LModeClasses.heading1First,
  },
  { nodes: ["ATXHeading2"], all: LModeClasses.heading2 },
  { nodes: ["ATXHeading3"], all: LModeClasses.heading3 },
  { nodes: ["ATXHeading4"], all: LModeClasses.heading4 },
  { nodes: ["ATXHeading5"], all: LModeClasses.heading5 },
  { nodes: ["ATXHeading6"], all: LModeClasses.heading6 },
  { nodes: ["Blockquote"], all: LModeClasses.blockquote },
  { nodes: ["BulletList"], all: LModeClasses.list },
  {
    nodes: ["OrderedList"],
    all: LModeClasses.list,
    first: LModeClasses.listOrderedStart,
  },
  {
    nodes: ["FencedCode"],
    all: LModeClasses.fencedCode,
    first: LModeClasses.fencedCodeStart,
    last: LModeClasses.fencedCodeEnd,
  },
  { nodes: ["TableHeader"], all: LModeClasses.tableHeader },
  { nodes: ["TableRow"], all: LModeClasses.tableRow },
];

/**
 * "Extra" line classes that are applied IN ADDITION to the
 * `all` class from the matching `LModeBlockRule`. Used for
 * the list variants that need both `cm-lmode-list` AND
 * `cm-lmode-list-bullet` / `cm-lmode-list-ordered` — those
 * pairs are split so the catalog doesn't need a "secondary
 * class" field on the block rule (which would be too narrow
 * for the case "this block needs the same extra class on
 * every line of any of its child nodes").
 */
export const LModeExtraLineClasses: ReadonlyArray<{
  readonly nodes: readonly string[];
  readonly cls: string;
}> = [
  { nodes: ["BulletList"], cls: LModeClasses.listBullet },
  { nodes: ["OrderedList"], cls: LModeClasses.listOrdered },
];

/**
 * Inline mark rules — applied to the parent node range as a
 * single `Decoration.mark`, so the visual style (italic, bold,
 * strikethrough, link color) follows the prose text. The
 * marker children inside the range are hidden separately by
 * the marker-hiding pass.
 */
export type LModeInlineRule = {
  readonly nodes: readonly string[];
  readonly className: string;
};

export const LModeInlineRules: readonly LModeInlineRule[] = [
  { nodes: ["Emphasis"], className: LModeClasses.emphasis },
  { nodes: ["StrongEmphasis"], className: LModeClasses.strong },
  { nodes: ["Strikethrough"], className: LModeClasses.strike },
  { nodes: ["Link"], className: LModeClasses.link },
];

/**
 * Lezer node names that represent Markdown marker characters —
 * syntactic glyphs, not the content the marker wraps. Each
 * range that matches a name in this set gets the
 * `LModeClasses.hiddenMarker` class, which CSS renders as a
 * zero-width transparent span. The full list of Lezer node
 * names lives in `@lezer/markdown` and the GFM extension.
 */
export const LModeMarkerNodeNames: ReadonlySet<string> = new Set([
  "HeaderMark",
  "EmphasisMark",
  "CodeMark",
  "QuoteMark",
  "ListMark",
  "LinkMark",
  "URL",
  "LinkLabel",
  "StrikethroughMark",
  "TaskMarker",
  "CodeInfo",
]);

/**
 * Active-line chip labels. The extension attaches a
 * `data-l-chip` attribute to any line that should show a chip
 * in the left margin (headings, blockquote, fenced code
 * start/end), and the CSS uses `content: attr(data-l-chip)`.
 *
 * Per user decision (v0.11+ design), chip labels stay Latin
 * (`H1` / `H2` / `> ` / ` ``` `) across all three menu
 * languages for muscle-memory parity with Markdown tooling —
 * so these strings are not part of the locale system.
 */
export const LModeChipLabels: Readonly<Record<string, string>> = {
  [LModeClasses.heading1]: "H1",
  [LModeClasses.heading2]: "H2",
  [LModeClasses.heading3]: "H3",
  [LModeClasses.heading4]: "H4",
  [LModeClasses.heading5]: "H5",
  [LModeClasses.heading6]: "H6",
  [LModeClasses.blockquote]: ">",
  [LModeClasses.fencedCodeStart]: "```",
  [LModeClasses.fencedCodeEnd]: "```",
};
