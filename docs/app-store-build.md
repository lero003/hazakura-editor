# App Store Build

Status: Draft
Scope: Mac App Store submission build path
Authority: High
Last reviewed: 2026-06-11

## Purpose

This document defines the public-safe helper-free Mac App Store build
lane for `Hazakura Editor`. It intentionally avoids account-specific
App Store Connect metadata, certificate names, signing identities,
contacts, screenshots, or private reviewer-copy drafts.

The App Store lane is a reviewable safe Markdown editor build. It omits:

- Agent Workbench
- CLI Agent launch
- dev mode
- arbitrary command execution
- Apple Local Assist helper / Apple Intelligence helper
- external AI/API calls
- network-required features

The Developer / GitHub lane remains separate and may include optional
Apple Local Assist and Agent Workbench behind their existing boundaries.

## App Identity

- App name: `Hazakura Editor`
- Bundle ID: `dev.hazakura.editor`
- Current version: `0.17.0`
- App Store category: `Productivity`
- Public Privacy Policy URL:
  `https://hazakura.dev/hazakura-editor/privacy/`

Keep SKU, Team ID, signing identity, App Store Connect contact data,
screenshots, and reviewer-copy drafts in ignored local notes, not in
tracked docs.

`src-tauri/tauri.conf.json` carries the base identifier
`dev.hazakura.editor`. App Store-specific overrides live in:

- `src-tauri/tauri.conf.appstore-preview.json`
- `src-tauri/tauri.conf.appstore.json`
- `src-tauri/entitlements/mac-app-store.entitlements`

## Local Files Not Committed

Do not commit certificates, private keys, API keys, or provisioning
profiles.

Download the App Store provisioning profile and place it locally at:

```txt
src-tauri/profiles/Hazakura_Editor_Mac_App_Store_Profile.provisionprofile
```

That path is ignored by `.gitignore` and is referenced only by
`src-tauri/tauri.conf.appstore.json`.

Place account-specific submission notes under ignored local paths such
as:

```txt
docs/internal/app-store-submission.local.md
```

## Entitlements

The App Store entitlement file is intentionally minimal:

```txt
src-tauri/entitlements/mac-app-store.entitlements
```

Allowed:

- `com.apple.security.app-sandbox`
- `com.apple.security.files.user-selected.read-write`
- `com.apple.security.files.bookmarks.app-scope` for restoring
  user-selected workspace folders across sandboxed app restarts
- `com.apple.security.network.client` for the Tauri/WebKit runtime to
  load bundled app assets under App Sandbox

Do not add these unless there is a fresh documented reason:

- `com.apple.security.network.server`
- `com.apple.security.automation.apple-events`
- temporary exception entitlements
- broad Desktop / Documents / Downloads access

## Build Commands

Local helper-free preview:

```bash
npm run build:app-store-preview
```

The preview command intentionally unsets `APPLE_SIGNING_IDENTITY` so a
previous submission shell does not leak an account-specific certificate
name into preview or Developer / GitHub lane signing output.

Submission-oriented App Store app bundle:

```bash
APPLE_SIGNING_IDENTITY="Apple Distribution: <Name> (<TEAM_ID>)" \
  npm run build:app-store-submit
```

The submit command uses:

```txt
src-tauri/tauri.conf.appstore.json
```

That config sets:

- `beforeBuildCommand` to `npm run build:vite`
- `frontendDist` to `../dist`
- `bundle.externalBin` to `[]`
- `bundle.macOS.entitlements` to `./entitlements/mac-app-store.entitlements`
- `bundle.macOS.files.embedded.provisionprofile` to the local profile path

The preview config uses the same helper-free build shape but does not
embed a provisioning profile.

## Verify The Built App

Adjust the path if you build a universal target and Tauri writes under a
target-specific directory.

```bash
APP="src-tauri/target/release/bundle/macos/Hazakura Editor.app"

codesign --verify --deep --strict --verbose=2 "$APP"
codesign -dv --verbose=4 "$APP"
codesign -d --entitlements - "$APP"
spctl --assess --type execute --verbose "$APP"
```

Check identity:

```txt
Identifier=dev.hazakura.editor
TeamIdentifier=<TEAM_ID>
Authority=Apple Distribution: ...
```

Check entitlements:

```xml
<key>com.apple.security.app-sandbox</key>
<true/>
<key>com.apple.security.files.user-selected.read-write</key>
<true/>
<key>com.apple.security.files.bookmarks.app-scope</key>
<true/>
<key>com.apple.security.network.client</key>
<true/>
```

Check helper omission:

```bash
test ! -e "$APP/Contents/MacOS/hazakura-apple-assist-helper"
```

## Build Output Sanity Checks

```bash
/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP/Contents/Info.plist"
find "$APP/Contents/MacOS" -maxdepth 1 -type f -print
```

Expected:

- `CFBundleIdentifier` is `dev.hazakura.editor`
- version is `0.17.0`
- `hazakura-editor` is present
- `hazakura-apple-assist-helper` is absent

## Manual Smoke Before Upload

Run on the actual App Store lane build:

- First launch succeeds.
- Create a new Markdown file.
- Open an existing Markdown file through user selection.
- Save succeeds.
- Save As succeeds.
- Preview renders.
- HTML export succeeds.
- Image paste and drag/drop do not break under sandboxed file access.
- Agent Workbench / CLI Agent / dev mode / Apple Local Assist are absent.
- No external network communication occurs; if any system handoff appears,
  record the reason.
- `Cmd+Q` with dirty tabs shows the dirty-tab confirmation flow.
- macOS red close button with dirty tabs shows the dirty-tab confirmation flow.
- Keyboard-only tab navigation works.
- VoiceOver announces the tab bar acceptably.
- Increase Contrast keeps controls legible.

Do not mark the build App Store-ready, submitted, approved, or
TestFlight-ready until the signing, local smoke, App Store Connect upload,
and Apple validation evidence all exist.

## App Store Connect Status Notes

The helper-free build lane and privacy-policy URL are defined here. App Store
Connect account work remains outside tracked public docs:

- provisioning profile and Apple Distribution identity selection
- upload / Apple validation evidence
- TestFlight distribution and smoke evidence
- screenshots and attachment material
- support URL, category / keywords / age rating, and final product-page fields
- private reviewer notes and contact details
