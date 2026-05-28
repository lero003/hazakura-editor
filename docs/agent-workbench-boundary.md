# Agent Workbench Boundary

Status: Operational
Scope: Optional CLI-agent workbench boundary
Authority: Medium
Last reviewed: 2026-05-29

## Purpose

`hazakura-note` supports an optional Agent Workbench mode while preserving the existing Markdown-first safe editor.

This is not a replacement for Safe Editor Mode. The default product value remains: open selected text files, edit them carefully, and confirm changes without turning the app into an IDE or terminal.

Agent Workbench mode is acceptable only while it remains explicit, reversible, and clear about responsibility.

## Product Shape

The intended split is:

```txt
Safe Editor Mode
=
Markdown/text editor
+ workspace file browser
+ sanitized preview
+ save/conflict/draft recovery
+ no process launch ability

Agent Workbench Mode
=
Safe Editor Mode
+ optional right-pane TUI agent host
+ allowlisted local CLI launcher
+ one interactive agent session
```

## Safe Editor Mode

Safe Editor Mode must remain usable without agent features.

Requirements:

- Agent pane hidden.
- CLI launcher hidden.
- PTY backend not initialized.
- Process-spawn command unavailable or denied.
- Backend launch commands reject requests while Agent Workbench mode is off.
- No generic terminal.
- No provider configuration required.
- Existing editor, preview, save, conflict, draft, and workspace behavior continues to work.

When possible, Safe Editor Mode should be a build-time variant rather than only a setting. A build without agent-host code is easier to explain and audit.

## Agent Workbench Mode

Agent Workbench mode may expose a right pane that starts an allowlisted local TUI coding-agent CLI inside the selected workspace root.

The precise boundary is:

- `hazakura-note` does not provide a general-purpose shell prompt.
- `hazakura-note` can directly launch only allowlisted agent CLIs.
- What the launched agent CLI can do internally depends on that CLI's own behavior and the user's actions inside it.

Allowed launch targets:

- `codex`
- `opencode`

The app must not expose an arbitrary command field.

Current implementation status:

- Agent Workbench is hidden unless the active app session has Agent Workbench enabled and responsibility-boundary consent acknowledged.
- The right pane can switch between Preview and an Agent pane shell only after that gate is satisfied.
- The Agent pane shell displays provider, provider availability, workspace root, consent, launch-gate status, session status, runtime status, and an xterm-based terminal surface for the selected provider session.
- If no workspace root is selected, the Agent pane reports launch unavailable.
- The launch button checks the backend launch preflight. The backend validates mode, consent, provider allowlist, workspace root, and whether the allowlisted provider CLI is discoverable through the app search path.
- Successful preflight with a found provider goes through a runtime adapter, then starts exactly one allowlisted provider process with `cwd` set to the canonical workspace root.
- The runtime adapter receives only the allowlisted provider, canonical workspace root, and resolved provider path. It does not receive an arbitrary command string.
- Provider PTY output is captured and rendered through the Agent pane terminal surface. User keyboard input from that surface is sent only to the running provider process stdin and is not stored as Agent output history.
- On macOS, the real runtime starts the allowlisted provider behind a minimal PTY so CLIs that require terminal stdin can start. The UI uses xterm for terminal rendering, but it is still scoped to the selected allowlisted provider session.
- The xterm surface reports its current rows/columns to the backend at launch and on resize so the provider PTY can be sized to the visible terminal area.
- Output is kept in a bounded in-memory buffer of 500 chunks; older chunks are discarded first.
- Automated stabilization uses temporary fake allowlist providers to exercise hazakura-side lifecycle, output, input, exit, stop, and error handling. Real `codex` / `opencode` checks remain trusted-workspace manual smoke, not automated approval of provider-internal behavior.
- Missing provider CLI is reported as provider not found; it does not fall through to arbitrary command lookup.
- While an active session exists, a second session start is rejected. Stopping the session goes through the runtime adapter stop boundary and terminates the provider process.
- Session state is in-memory only and is not restored after app restart.
- Full-screen TUI behavior may still need provider-specific manual smoke, but raw terminal control output is no longer rendered as plain text in the Agent pane.
- No arbitrary command input, arbitrary path input, shell selector, session restore, auto-apply, auto-commit, or Git integration is implemented.
- Files changed by the launched CLI are still surfaced through the existing external-change/conflict handling path where the Safe Editor already observes on-disk changes.

Requirements:

- User explicitly enables Agent Workbench mode.
- Enabling Agent Workbench mode requires restart before agent UI or backend launch commands become available.
- The initial mode gate stores the requested mode separately from the active app-session mode.
- The backend launch entry rejects while the active app-session mode is off, even if a caller bypasses hidden UI.
- Provider selection is limited to `codex` and `opencode` in both UI and backend validation.
- First-use consent is stored locally and required before the backend launch entry can pass its gate.
- Provider CLI discovery is limited to the allowlisted provider name after provider validation. The app search path starts from the app process `PATH` and adds common macOS GUI-launch gaps such as Homebrew and user bin directories; it does not accept arbitrary command names.
- User explicitly starts the session.
- Exactly one TUI agent session may run at a time.
- Session starts with `cwd` set to the selected workspace root.
- User can send keyboard input to the running TUI.
- User can stop the session.
- Closing the app stops the session.
- Session is not restored after app restart.
- No background agent execution continues after app close.

## Responsibility Boundary

Agent Workbench mode changes the trust model.

`hazakura-note` may launch a selected local CLI, but it does not control or guarantee what that CLI does. The launched CLI may read, create, modify, delete, or run files depending on its own behavior, permissions, and user choices inside the CLI. Some agent CLIs may allow the user to approve command execution from inside the CLI; `hazakura-note`'s boundary is that it does not become the general-purpose terminal or arbitrary-command launcher.

The user is responsible for:

- Choosing a trusted workspace.
- Choosing whether to enable Agent Workbench mode.
- Understanding the selected CLI's permissions and behavior.
- Reviewing file changes made by the CLI.
- Deciding whether to keep, revert, commit, publish, or discard those changes outside `hazakura-note`.

The app is responsible for:

- Not presenting Agent Workbench as a safe-editor-only mode.
- Not exposing a general-purpose shell prompt.
- Not accepting arbitrary launch commands.
- Making the active workspace root visible before launch.
- Making the warning visible before the first launch and after configuration changes.
- Requiring explicit consent before any launch gate can pass.
- Detecting relevant on-disk changes through the existing external-change path where practical.

## MVP Non-goals

The first Agent Workbench implementation must not include:

- General-purpose terminal emulator for arbitrary shell commands.
- Shell prompt.
- Arbitrary command launcher.
- VS Code compatible IDE.
- Built-in AI agent or model orchestration.
- Automatic accept, commit, push, publish, or release flow.
- Multiple agent sessions.
- Persistent terminal history.
- Session restore after restart.
- Background agent execution after app close.
- Git client features inside `hazakura-note`.
- LSP, debugger, extension host, or package-manager UI.
- Auto-apply, auto-commit, auto-push, or auto-publish.

## Context Helpers

Context helpers may be added only as copy/paste aids.

Acceptable MVP helpers:

- Copy active file path.
- Copy open tab paths.
- Copy workspace root.
- Copy a prompt template.

Not in the MVP:

- Automatic prompt submission.
- Automatic file application.
- Automatic approval of CLI actions.
- Project-wide indexing.
- Build/test command execution by `hazakura-note`.

## Ongoing Change Gate

Before future changes widen this boundary, the project should decide:

- Mode shape: whether the change still belongs in optional Agent Workbench mode or should remain out of scope.
- Runtime gate: whether restart-required enablement, disabling, and Safe Editor fallback remain clear.
- Backend gate: whether launch commands still reject requests when Agent Workbench mode is off, independent of hidden UI.
- Build gate: whether Safe Editor Mode can be audited without treating Agent Workbench as the default product.
- Provider gate: whether provider commands remain allowlisted and path resolution remains non-arbitrary.
- Consent gate: whether responsibility wording still matches the actual provider capability.
- Workspace gate: whether the selected workspace root stays visible before launch and untrusted/no-workspace states remain safe.
- Lifecycle gate: whether start, stop, app close, crash, and restart cleanup remain one-session and no-restore.
- Change-detection gate: whether files modified by the CLI still surface through external-change/conflict handling.
- Verification gate: whether tests or smoke checks still prove that arbitrary shell launch is not exposed.
- Documentation gate: this boundary document must be updated before implementation changes widen the trust boundary.

This document is the implemented boundary claim for the current Agent Workbench slice. It is not approval for future expansion into a general terminal, agent platform, Git client, auto-apply flow, or release/publish workflow.
