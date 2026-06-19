# App Store Build

Status: Operational
Scope: Mac App Store submission build path
Authority: High
Last reviewed: 2026-06-19 (v0.25 version alignment; 0.20 build 16 superseded)

## Purpose

This document defines the public-safe helper-free Mac App Store build
lane for `Hazakura Editor`. It is an internal operational note for
maintainers and release agents, not public App Store product copy. It
intentionally avoids account-specific App Store Connect metadata,
certificate names, signing identities, contacts, screenshots, or private
reviewer-copy drafts.

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
- Published App Store version: `0.19.0`
- Current source / Developer version: `0.25.0`
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

Submission-oriented App Store package:

```bash
APPLE_SIGNING_IDENTITY="Apple Distribution: <Name> (<TEAM_ID>)" \
APPLE_INSTALLER_SIGNING_IDENTITY="3rd Party Mac Developer Installer: <Name> (<TEAM_ID>)" \
  npm run build:app-store-pkg
```

`npm run build:app-store-pkg` increments
`src-tauri/tauri.conf.appstore.json` `bundle.macOS.bundleVersion` before
building, and that value becomes `CFBundleVersion`. App Store Connect
requires this value to be higher than any previously uploaded build for
the same app version, including builds that were uploaded but later
rejected for validation issues. Keep this value as a positive integer
counter (`1`, `2`, `3`, ...), separate from the user-visible app version.

The package script derives the output path from `package.json` `version`
and the newly incremented App Store `bundleVersion`. Do not hand-edit
the `HazakuraEditor-<version>-build<build>-mas.pkg` name. If a manual
counter-only bump is ever needed, `npm run bump:app-store-build` remains
available, but the normal package path should use `build:app-store-pkg`
so the counter and filename advance together.

The submit command uses:

```txt
src-tauri/tauri.conf.appstore.json
```

That config sets:

- `beforeBuildCommand` to `npm run build:vite`
- `frontendDist` to `../dist`
- `bundle.externalBin` to `[]`
- base `bundle.resources` to include `LICENSE` and
  `THIRD_PARTY_NOTICES.md` inside `Contents/Resources`
- `bundle.macOS.bundleVersion` to the current App Store Connect build number
- `bundle.macOS.entitlements` to `./entitlements/mac-app-store.entitlements`
- `bundle.macOS.files.embedded.provisionprofile` to the local profile path

The preview config uses the same helper-free build shape, but deliberately
skips the App Store sandbox entitlements and provisioning profile so
`npm run build` produces a launchable local smoke bundle. Use
`npm run smoke:macos-sandbox-preview` for a local sandbox-entitlement
probe, and use `npm run build:app-store-submit` plus `productbuild` for
the signed TestFlight / App Store Connect lane.

Run the lightweight App Store surface smoke before submission-facing
builds or metadata review:

```bash
npm run smoke:app-store-surface
```

This does not replace signed TestFlight manual smoke. It only pins that
the App Store lane keeps CLI Agent / Agent Workbench / Apple Local
Assist commands, settings, helper assumptions, and visible dev badges
out of the source-tested surface.

## Bundled Notices

All Tauri build lanes inherit the base `bundle.resources` setting in
`src-tauri/tauri.conf.json`, which copies these repository-root files
into the generated macOS app bundle:

```txt
Contents/Resources/LICENSE
Contents/Resources/THIRD_PARTY_NOTICES.md
```

These files are the packaged license / third-party notice surface for
the app bundle. The in-app Help page remains a readable acknowledgement
summary; before submission, refresh and review the notice contents from
the current lockfiles.

## Verify The Built App

Adjust the path if you build a universal target and Tauri writes under a
target-specific directory.

```bash
APP="src-tauri/target/release/bundle/macos/Hazakura Editor.app"

codesign --verify --deep --strict --verbose=2 "$APP"
codesign -dv --verbose=4 "$APP"
codesign -d --entitlements - "$APP"
spctl --assess --type execute --verbose "$APP"
npm run probe:macos-distribution -- "$APP"
```

Check identity:

```txt
Identifier=dev.hazakura.editor
TeamIdentifier=<TEAM_ID>
Authority=Apple Distribution: ...
```

For a signed submit bundle or an intentionally sandbox-re-signed preview,
run the probe with entitlement enforcement:

```bash
REQUIRE_APP_STORE_ENTITLEMENTS=1 npm run probe:macos-distribution -- "$APP"
```

Check entitlements on the signed App Store artifact:

```xml
<key>com.apple.application-identifier</key>
<string><TEAM_ID>.dev.hazakura.editor</string>
<key>com.apple.developer.team-identifier</key>
<string><TEAM_ID></string>
<key>com.apple.security.app-sandbox</key>
<true/>
<key>com.apple.security.files.user-selected.read-write</key>
<true/>
<key>com.apple.security.files.bookmarks.app-scope</key>
<true/>
<key>com.apple.security.network.client</key>
<true/>
```

For the current App Store provisioning profile, `<TEAM_ID>` is
`8BNUB2R9C8`. The signed app and embedded provisioning profile must agree
on `com.apple.application-identifier`; otherwise App Store Connect can
accept the upload but mark the build ineligible for TestFlight with
warning 90886.

Check helper omission:

```bash
test ! -e "$APP/Contents/MacOS/hazakura-apple-assist-helper"
```

## Build Output Sanity Checks

```bash
/usr/libexec/PlistBuddy -c "Print :CFBundleIdentifier" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$APP/Contents/Info.plist"
/usr/libexec/PlistBuddy -c "Print :CFBundleVersion" "$APP/Contents/Info.plist"
find "$APP/Contents/MacOS" -maxdepth 1 -type f -print
```

Expected:

- `CFBundleIdentifier` is `dev.hazakura.editor`
- `CFBundleShortVersionString` is the current package version (`0.25.0`
  for the next candidate)
- `CFBundleVersion` is a positive integer higher than the last uploaded
  App Store Connect build
- `LSMinimumSystemVersion` is `26.0`
- `hazakura-editor` is present
- `hazakura-apple-assist-helper` is absent

## Transporter Package For Internal TestFlight

Use this step only after the submission-oriented App Store app bundle is
signed and the local checks above have passed. This is internal
distribution work for App Store Connect / TestFlight, not a public
download lane.

Transporter receives a signed installer package:

```txt
*.pkg
```

Do not upload:

- the raw `.app` bundle
- a `.dmg`
- a `.sha256`
- any `warning-expected` DMG preview artifact

The `warning-expected` DMG lane is the Developer / GitHub preview lane
and must stay separate from App Store Connect / TestFlight uploads. It
may use Developer ID Application signing for GitHub Release assets, but
that does not make it an App Store, TestFlight, or notarized artifact.

`scripts/build-app-store-pkg.mjs` increments the App Store build counter,
builds the signed App Store app bundle, runs the macOS distribution probe
with App Store entitlement checks, creates the signed installer package
with `productbuild`, verifies the package signature, and prints the
SHA-256 plus `PKG_PATH`.

Verify the package before opening Transporter:

```bash
pkgutil --check-signature "$PKG"
spctl --assess --type install --verbose=4 "$PKG"
```

Upload the `PKG_PATH` printed by `npm run build:app-store-pkg` with
Transporter. After upload,
record the App Store Connect processing result, TestFlight internal
group assignment, and any Apple validation warnings in ignored
`docs/internal/` notes. Tracked docs may record public-safe summaries
such as app version, build number, warning/no-warning outcome, and
manual smoke result, but should not include raw Transporter logs,
request headers, account metadata, or device identifiers.

## Manual Smoke Before Upload

Run on the actual App Store lane build:

- First launch succeeds.
- Create a new Markdown file.
- Open an existing Markdown file through user selection.
- Save succeeds.
- Save As succeeds.
- Repeated quit/relaunch preserves the selected workspace.
- Quit/relaunch while an outside-workspace tab is active still
  preserves the selected workspace or shows a clear reauthorization
  path.
- Preview renders.
- HTML export succeeds.
- Image paste and drag/drop do not break under sandboxed file access.
- Move to Trash either succeeds without `osascript` / AppleEvents /
  automation entitlements or is unreachable in the App Store lane.
- Agent Workbench / CLI Agent / dev mode / Apple Local Assist are absent,
  including command palette entries such as `Agent`, `Apple Local
  Assist`, `CLI Agent`, and `Assist Settings…`.
- No external network communication occurs; if any system handoff appears,
  record the reason.
- `Cmd+Q` with dirty tabs shows the dirty-tab confirmation flow.
- macOS red close button with dirty tabs shows the dirty-tab confirmation flow.
- Keyboard-only tab navigation works.
- VoiceOver announces the tab bar acceptably.
- Increase Contrast keeps controls legible.

For each new build, do not mark it App Store-ready, submitted, or
approved until the signing, local smoke, App Store Connect upload, Apple
validation, metadata, and App Review evidence all exist.

## Reviewer Note Prompts

Keep the final reviewer note in ignored local files, but make sure it
can answer these public-safe points before submission:

- `com.apple.security.network.client` is present so the Tauri/WebKit
  runtime can load bundled app assets under App Sandbox. The App Store
  lane is not designed to contact external services and keeps
  network-required features out of the submitted build. Pair this with a
  TestFlight smoke note that no external network communication was
  observed.
- Script-like file associations such as `.sh`, `.bash`, `.zsh`,
  `.fish`, and `.ps1` are treated as text-editor inputs only. Opening
  those files does not execute them, launch a shell, run a terminal, or
  provide arbitrary command execution.
- Move to Trash must not be explained as an automation or scripting
  feature. Before submission, make sure the App Store lane either uses a
  native macOS Trash path or does not expose the operation.
- The App Store lane omits Apple Local Assist helper, Agent Workbench,
  CLI Agent launch, dev mode, arbitrary command execution, and external
  AI/API calls. The Developer / GitHub lane remains separate.
- If asked about `style-src 'unsafe-inline'`, explain it as the current
  Tauri/React UI styling allowance; do not broaden it into any claim
  that scripts, remote content, or external network calls are allowed.

## App Store Connect Status Notes

The helper-free build lane and privacy-policy URL are defined here.
Future App Store Connect account work remains outside tracked public
docs:

- provisioning profile and Apple Distribution identity selection
- Transporter package path and installer signing identity
- upload / Apple validation evidence
- TestFlight distribution and smoke evidence
- screenshots and attachment material
- support URL, category / keywords / age rating, and final product-page fields
- private reviewer notes and contact details

v0.18 release-prep note: the warning-expected Developer / GitHub DMG app
launched locally and from the mounted DMG. An earlier ad-hoc helper-free
App Store preview bundle that carried App Store sandbox entitlements failed
with `RBSRequestErrorDomain Code=5` / `Launchd job spawn failed`, so local
`npm run build` smoke now skips those entitlements. Treat App Store-lane
launch validation as part of the signed submit / TestFlight proof, not as
covered by local ad-hoc entitlement probes.

v0.18 TestFlight note: on 2026-06-12, the signed
`HazakuraEditor-0.18.0-mas.pkg` for app version `0.18.0` and build `4`
was delivered through Transporter and reached TestFlight distribution
with no reported Apple validation warnings. Basic launch and save smoke
on the TestFlight build passed. Fuller manual smoke, final metadata, and
App Review submission / approval remain separate evidence.

v0.19 approval note: the user-visible app version `0.19.0` passed App
Review and was published on 2026-06-18. The public listing is
`https://apps.apple.com/jp/app/hazakura-editor/id6778637880?mt=12`.
The tracked submit-lane candidate for the approval was build counter
`14`; do not reuse the `0.18.0` build `4` TestFlight result as proof for
future submissions.
In local Codex packaging, the signed submit-lane bundle reported the
expected `0.19.0` / `14` metadata, `15.0` minimum macOS, and
entitlements. Local Gatekeeper
assessment can still report `Insufficient Context` for this lane; treat
launch validation for a future build as signed TestFlight or App Store
proof, not as covered by local package inspection alone.

The local release-candidate package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.19.0-build14-mas.pkg
```

`productbuild --synthesize` emitted a Distribution XML
`allowed-os-versions` entry with `min="15.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl --assess --type install` rejected the
local package, so treat that as local trust-policy evidence rather than
an App Store Connect validation result. SHA-256:

```txt
85aa5f5ce887a2639f7905b418adb9aadabbe30a9541f08ef7520c08e603048c
```

v0.20 package-candidate note: on 2026-06-19, Codex generated a local
App Store submit-lane package for user-visible version `0.20.0` and
App Store build counter `16`. This package was superseded before upload
when the release target moved to `0.25.0`. Do not submit this package;
regenerate a fresh `0.25.0` App Store submit-lane package before
Transporter / App Store Connect work.

The local package generated for this lane is:

```txt
src-tauri/target/universal-apple-darwin/release/bundle/pkg/HazakuraEditor-0.20.0-build16-mas.pkg
```

The signed submit-lane bundle reported `CFBundleIdentifier`
`dev.hazakura.editor`, `CFBundleShortVersionString` `0.20.0`,
`CFBundleVersion` `16`, and `LSMinimumSystemVersion` `26.0`. It had the
expected App Sandbox, user-selected read/write, app-scoped bookmark, and
network-client entitlements; it omitted the Apple Local Assist helper
and included bundled `LICENSE` / `THIRD_PARTY_NOTICES.md` resources.
`productbuild --synthesize` emitted a Distribution XML
`allowed-os-versions` entry with `min="26.0"`.
`pkgutil --check-signature` passed with the 3rd Party Mac Developer
Installer certificate. `spctl --assess --type install` rejected the
local package, so keep treating that as local trust-policy evidence
rather than an App Store Connect validation result. SHA-256:

```txt
b2bf37df86b7e589dd34411635f68988b27b24a9db87f7125833c1471938eb50
```
