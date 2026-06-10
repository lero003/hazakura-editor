# App Store Review Notes Draft (Internal)

Last updated: 2026-06-10
Status: draft for internal review
Scope: App Store-quality evidence prep (excludes App Store Connect metadata, certificates, signing, notarization, DMG packaging, and upload)

## App summary

`hazakura editor` is a **Markdown-first safe editor** for local text workflows.
It is intentionally focused on:

- opening user-selected folders/files,
- editing Markdown/text safely,
- saving and restoring local work,
- previewing and exporting content,
- reviewing AI-assisted text edits through an explicit diff/discard path.

It is not marketed as an IDE, terminal, project-indexing service, or general-purpose command executor.

## Product shape and distribution lanes

The app keeps Safe Editor as the default surface.
The current repository separates:

- App Store lane (preview orientation): CLI Agent / Agent Workbench execution surfaces are intentionally omitted. Assist Surface remains limited to App Store-allowed choices such as Apple Local Assist / Off.
- Developer / GitHub lane: optional Agent Workbench remains available behind explicit mode/consent gates.

If you are reviewing App Store lane behavior, please evaluate only what is exposed in that lane and do not assume Developer / GitHub lane features.

## Core behavior to explain to App Review

### 1) Local data and file access

The app reads and writes files the user selects through the app UI (folder/file dialogs and workspace actions).
It does not scan the whole home directory automatically.

The app uses local recovery paths (including `.hazakura/backups/...`) for safety handling of unsaved data and restore flows.

When restoration is blocked by sandbox authorization loss, the app skips inaccessible restored paths and tells the user to use Open / Open Folder to reauthorize access instead of silently reopening files.

### 2) Restore and conflict behavior

When a previously opened file cannot be accessed due to permission state, the app does not silently continue from the stale path.  The current UX tells the user to re-open the file or folder through the normal picker before continuing.
This avoids opening files from stale path strings without corresponding access.

Restore/backup/recovery handling is recoverable and surfaced through existing app state and recovery workflow.

### 3) Privacy, local data disclosure, and Help documents

The app has in-app Help entries for:

- `Local Data Disclosure` — technical local-data behavior.
- `Privacy Policy` — App Store / public-copy draft.
- `Open Source Acknowledgements` — readable acknowledgement of primary direct dependencies.
- `About hazakura editor` — product identity, support direction, and distribution-lane wording.

The Privacy Policy copy is now available in-app as a draft, but the final public URL / App Store metadata copy must still be reviewed before submission.

- No implementation claim is made for cloud sync in this lane.
- No user content is exported unless the app is asked to save/export by user action.
- No in-app analytics / tracking / telemetry behavior is presented as part of this product slice.

### 4) Markdown preview / export safety

Preview is text-centric:

- dangerous HTML/script constructs are blocked,
- external URL/script-like behavior is constrained in line with implemented rendering rules,
- external images and unsupported link destinations are not blindly loaded,
- image exports use in-app image handling designed for local-only flow.

### 5) Apple Local Assist

Apple Local Assist behavior is explicitly availability-gated.
- It can be used as an on-device assist option where the helper is available.
- It is not forced on by default and requires explicit use flow.
- Suggestions are not auto-applied; edits remain unsaved and must go through explicit review-style handling before user save.

### 6) App Store lane Agent Workbench exclusion

In App Store-targeted path, CLI Agent / Agent Workbench execution behavior is intentionally removed from user entry points and command surfaces.  Assist Surface can remain visible only for non-CLI choices that are valid for the App Store lane.
This is part of the release boundary for this lane, not a removal from other lanes.

## Reviewer smoke steps (app behavior)

Use the current UI labels for each run and keep screenshots to each step.

1. Launch app from App Store lane build.
2. Open Folder (select a test directory with Markdown/text files).
3. Open a Markdown/text file.
4. Edit and save.
5. Open preview / export and confirm expected output.
6. Verify Help entries are discoverable from Help: Local Data Disclosure, Privacy Policy, Open Source Acknowledgements, and About hazakura editor.
7. Verify Apple Local Assist visibility and availability state where supported.
8. If restore permission is intentionally broken in test environment, verify Open / Open Folder reauthorization guidance appears and the file is not reopened silently.

## What should be listed under limitations

The following are intentionally outside this request scope and should remain unclaimed in App Review Notes:

- certificate / provisioning / TestFlight / App Store upload status,
- notarization status,
- final public Privacy Policy URL,
- full third-party license packet review,
- general approval outcome claims,
- App Store Connect metadata completion.

## Evidence notes for external agent hand-off

- This draft is aligned to `docs/security-boundary.md` and `docs/agent-workbench-boundary.md`.
- Distribution split and App Store omission context should remain consistent with `docs/current-status.md`.
- Keep boundary wording strict: Safe Editor primary, Agent Workbench is lane-specific, optional, and explicit.
- If a claim cannot be verified in current source behavior, mark it as `要確認`.
