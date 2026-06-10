# WorkspaceTree Accessibility Decision

Status: Decision
Scope: Whether to adopt a formal ARIA `role="tree"` pattern for `WorkspaceTree`
Authority: Medium (product a11y)
Last reviewed: 2026-06-10 (v0.18 review-intake note)

## Decision

For v0.17, the `WorkspaceTree` keeps its current **button-based,
keyboard-operable** model and intentionally does **not** adopt the
formal ARIA `role="tree"` pattern. The closeout `Not Yet Implemented`
table is updated to reflect this intentional keep-decision, not an
open follow-up.

A future slice may revisit this if user feedback, a specific VoiceOver
or AT gap, or a new cross-tree keyboard expectation makes the
full pattern justified.

## Why the current model is acceptable

`WorkspaceTree` is implemented as nested `<button>` rows inside
`.tree-children` containers. The relevant affordances today:

- Each file row is a real `<button type="button">`, focusable via
  Tab, activated by `Enter` / `Space` (browser default for
  buttons).
- Each directory row is a real `<button type="button">` with
  `aria-expanded={expanded}` (already wired), so screen readers
  announce the disclosure state when focus lands on a directory.
- The rename flow replaces the row's label with a real
  `<input type="text">`, so the active rename target stays
  keyboard-accessible and its `Enter` / `Escape` / blur cancel
  contract is announced correctly.
- The workspace-tree container handles `Escape` to clear the
  compare selection only when the user is not editing a name.
  The rename input's own `Escape` cancel runs first because it
  is the event target.
- The compare-selection "click on empty area clears" affordance
  keeps the disclosure tree from trapping a user mid-session.

Together, these satisfy the WCAG 2.2 AA-relevant tree-style
guidance (Name, Role, State, Keyboard) at the cost of not being
a strict WAI-ARIA `tree` widget.

Review-intake caveat (2026-06-10): the current implementation
renders that rename `<input>` inside the normal row `<button>` for
both file and directory rows.  The v0.17 decision to avoid a partial
ARIA `tree` conversion still stands, but nested interactive controls
are a credible VoiceOver / focus / click / blur risk.  A v0.18 slice
should consider rendering rename state as a non-button row containing
only the input, while keeping the normal non-rename rows as buttons.

## Why a full `role="tree"` is not justified for v0.17

A complete ARIA tree pattern requires all of the following, and
the workspace tree today has **none** of them:

1. `role="tree"` on the container, `role="treeitem"` on each
   row, `role="group"` on the children container.
2. `aria-level`, `aria-posinset`, and `aria-setsize` on every
   treeitem so the AT can announce position.
3. **Roving `tabindex`** so only the focused treeitem is in the
   tab order; the rest are `tabindex="-1"`.
4. Full keyboard contract: `ArrowDown` / `ArrowUp` move
   focus, `ArrowRight` expands or enters a child,
   `ArrowLeft` collapses or moves to the parent, `Home` /
   `End` jump to the first / last visible treeitem, optional
   type-ahead.
5. Single-selection and multi-selection semantics consistent
   with the active editor (`activePath` /
   `compareSelectionEnabled`).

The current `WorkspaceTree` has additional behaviours that
interact non-trivially with the strict pattern:

- **250 ms click-debounce for single vs. double click.** A
  partial role change that lets the user `ArrowRight` to a
  directory and "press Enter to expand" still has to honour
  the 250 ms window so a future double-click on the same
  row can still enter rename mode. Wiring both keyboard
  activation and the debounce into the same state machine
  needs focused tests, not just a markup pass.
- **Rename input replaces the row's label mid-interaction.**
  A roving-tabindex pattern has to yield the tab order to
  the rename `<input>` and restore it on commit / cancel.
  This is solvable but is a small state machine on its own.
- **Internal `application/x-hazakura-workspace-move` drag /
  drop** between directories. Strict tree pattern says
  keyboard drag should be supported (e.g. `Space`-then-arrow
  drag-mode). The current implementation supports native
  pointer drag only; a partial keyboard-drag addition would
  make the surface inconsistent.
- **Context menu via right-click** is wired with
  `onContextMenu`. A partial tree pattern without a
  keyboard-accessible context menu (typically `Shift+F10` or
  the menu key) would regress real keyboard use.
- **Compare-selection mode** is a separate selection state
  layered on top of the tree. A partial tree pattern that
  silently treats compare-mode clicks as a "tree selection"
  would break the existing "click to set source / target /
  clear" contract that has its own focus and `Escape`
  handling.

Doing each of these partially (markup only, or markup plus
some keyboard handling) is the well-known way to make
accessibility worse rather than better: the AT sees a
`treeitem` and announces "press Right to expand" but the
focused row does not respond.

## v0.17 follow-up scope (what is added now)

- Decision document (this file) so the next agent or human
  reviewer can see *why* the model was kept.
- Focused `WorkspaceTree` tests that pin the existing
  behaviour, so any future regression in the
  keyboard-operable button model fails the build rather than
  shipping silently:
  - `aria-expanded` reflects the directory state.
  - The disabled state on a directory button during async
    `onLoadDirectory` is preserved.
  - Rename input `Enter` commits via `onSubmitRename`.
  - Rename input `Escape` and blur cancel via
    `onClearRenaming`.
  - The workspace-tree container's `Escape` clears the
    compare selection only when no rename is active.
  - Clicking the container's empty area clears the compare
    selection when one exists.
  - Context menu is reachable on both file and directory
    rows.

No markup change to `WorkspaceTree.tsx` ships in this slice.

## Revisit criteria (when to re-open this decision)

A future slice should re-evaluate adopting the full ARIA tree
pattern if any of the following becomes true:

- A real VoiceOver user (macOS Safari) reports the disclosure
  tree is hard to navigate without `ArrowDown` / `ArrowUp`.
- A future feature needs cross-tree keyboard actions
  (e.g. multi-select with `Space`, or "move with keyboard")
  that the button-based model cannot express.
- An external review (e.g. App Review accessibility
  feedback) explicitly requires `role="tree"`.
- The `WorkspaceTree` is reused in a context where AT users
  expect a strict tree widget (e.g. as a control in a
  larger dialog that is itself inside a tree-style surface).

Until then, the button-based model is the deliberate v0.17
choice and is the accessibility evidence we ship.

## Related documents

- `docs/v0.17-external-agent-requests.md` — original
  `workspace-tree-role-audit` request.
- `docs/app-store-quality-closeout.md` — closeout
  `Not Yet Implemented` table updated to point here.
- `src/components/workspace/WorkspaceTree.tsx` — current
  implementation.
- `src/components/workspace/WorkspaceTree.test.tsx` —
  focused tests pinning the current behaviour.
