# Core AI Apple-hosted E4B handoff

Status: Source-ready; Apple asset upload and TestFlight device acceptance blocked
Scope: Internal TestFlight path for Gemma 4 E4B only
Authority: Verification record
Last reviewed: 2026-09-21

## Fixed identifiers

| Item | Identifier |
| --- | --- |
| Main app | `dev.hazakura.editor` |
| Background Download extension | `dev.hazakura.editor.background-downloader` |
| Shared App Group | `group.dev.hazakura.editor` |
| E4B asset pack | `dev.hazakura.editor.coreai.gemma4-e4b.v1` |
| Model catalog revision | `2026.09.20.1` |

The app and extension App IDs have already been associated with the same App Group in the
Developer portal. Tracked source contains no certificate, private key, or provisioning-profile
content.

## Implemented source path

- The App Store configurations merge only `BAAppGroupID`,
  `BAHasManagedAssetPacks=YES`, and `BAUsesAppleHosting=YES` from
  `src-tauri/Info.appstore.plist`.
- `HazakuraBackgroundDownloader.appex` is an Apple-hosted managed Background Download
  extension using StoreKit `StoreDownloaderExtension`. Both targets declare the shared App Group.
- The App Store lane publishes only the pinned E4B model. Developer builds keep the production
  catalog empty and retain the separate Qwen fixture override.
- `AssetPackManager` resolves the Apple-hosted manifest, starts the on-demand download, reports
  progress, resumes through the same start call, removes the pack, and resolves a process-scoped
  model URL. `BADownloadManager` is used only to find and cancel the matching in-flight pack.
- The Rust store never accepts a renderer-provided URL or path. It compares the materialized
  `hazakura-resource-manifest.json` with the manifest embedded in the signed app, checks safe
  regular-file paths and byte sizes, verifies every pinned SHA-256 on first use, then writes an
  app-private validation receipt. Missing, partial, symlinked, corrupt, or unverified payloads are
  not `Ready` and are never passed to the production helper.
- Settings and the Local Assist window consume one native model-state event. Selection changes
  force a fresh availability probe before sending is enabled.
- Deleting the selected E4B model first switches to System through the existing generation lock.
  An active E4B generation therefore prevents removal instead of invalidating its model path.

The Background Assets URL is intentionally resolved again after each app launch and is not
persisted. Whether the inherited helper sandbox can load that process-scoped materialization is a
remaining signed TestFlight/device acceptance item; source and local builds cannot prove it.

## Signing handoff

The extension Xcode target uses Automatic Signing when opened interactively. The repository's
actual Tauri submission workflow already embeds a manual main-app profile, so the scripted submit
path requires both local ignored files:

```txt
src-tauri/profiles/Hazakura_Editor_Mac_App_Store_Profile.provisionprofile
src-tauri/profiles/Hazakura_Background_Downloader_Mac_App_Store_Profile.provisionprofile
```

Regenerate both Mac App Distribution profiles after enabling the App Group. The extension profile
must belong to `dev.hazakura.editor.background-downloader`; the main profile must belong to
`dev.hazakura.editor`. Both must contain `group.dev.hazakura.editor`. Do not commit either file.

## `.aar` blocker

`npm run coreai:ba-package:reproduce` isolates packaging from all model scripts. On this host:

```txt
macOS 27.0 (26A428)
Xcode 27.0 (27A266a)
ba-package 2.0
```

`xcrun ba-package template` succeeds to stdout. The following all fail at argument validation with
exit 64 and `path extension isn’t “json”` before manifest content is evaluated:

- Apple's own template with `template --output-path .../apple-template.json`
- a 41-byte asset and minimal valid JSON with `evaluate .../manifest.json`
- the same fixture with `package .../manifest.json --output-path ...smoke.v1.aar`
- the pinned E4B Background Assets manifest

This classifies the current failure as a toolchain path-extension-validation defect, not an npm
wrapper, model-manifest, payload-size, or archive-format issue. No fake `.aar` is created. A corrected
Xcode `ba-package` or Apple's official compatible packaging tool is required before upload.

Expected output after that toolchain is available:

```txt
.hazakura/coreai-production/gemma4-e4b/2026.09.20.1/archives/
├── dev.hazakura.editor.coreai.gemma4-e4b.v1.aar
├── archive.json
└── UPLOAD-INSTRUCTIONS.md
```

The App Store Connect asset-pack version is assigned and incremented by Apple at upload time. It is
not the catalog revision and cannot be reported before a successful upload/processing result.

## Local verification

- `npm run coreai:models:verify -- --model=gemma4-e4b`: 12 files and 6,807,926,119 expanded
  bytes match the production lock. The generated payload resource manifest exactly matches the
  signed runtime resource and its SHA-256 is
  `d46c81f18147a2faf0d066b4ef2d31f72416b75ee544397580815fa2e4fb4af3`.
- `npm run coreai:ba-package:reproduce`: the minimal fixture reproduces the toolchain defect above;
  no `.aar` exists.
- `npm run typecheck`, `npm run build:vite`, and `npm test`: pass. Vitest reports 295 files and
  2,646 tests; the production-model scripts report another 10 tests.
- `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` and
  `cargo test --manifest-path src-tauri/Cargo.toml`: pass; 417 tests passed and 2 session-dependent
  tests were ignored.
- `swift test --package-path src-helpers/apple-assist`: 24 tests pass. Import Assist has no test
  target; its release build passes.
- `npm run smoke:app-store-surface`: 10 files and 129 tests pass.
- `npm run build`: passes, including the Core AI helper and unsigned Xcode build/embedding of the
  universal Background Download extension. The local ad-hoc preview passes the distribution probe
  for bundle IDs, extension point, the three Background Assets keys, extension App Group
  entitlement, nested helpers, and deep signature. This is not Distribution signing, Apple upload,
  or TestFlight evidence.

## Internal TestFlight acceptance

After a corrected toolchain produces the archive:

1. Run `npm run coreai:models:package -- --model=gemma4-e4b`; retain the `.aar`, `archive.json`,
   resource manifest, and digest together.
2. Upload only `dev.hazakura.editor.coreai.gemma4-e4b.v1.aar` with Transporter, App Store Connect API,
   `iTMSTransporter`, or `altool`. Wait for processing and record the Apple-assigned version.
3. Install the regenerated main and extension distribution profiles, then build the signed app/pkg.
   Confirm the nested extension ID, extension point, App Group entitlements, and three `BA*` keys
   with `REQUIRE_APP_STORE_ENTITLEMENTS=1 npm run probe:macos-distribution -- <app-path>`.
4. Upload the app build. Internal TestFlight automatically uses the latest processed version of the
   compatible asset-pack ID; confirm it under `TestFlight > Builds & Assets > Asset Packs`.
5. On a macOS 27 test Mac, open Settings, start `Gemma 4 E4B`, observe progress, cancel once, and
   press Resume. Confirm approximately 6.8 GB completes and the state changes through verification
   to `Ready`.
6. Press `Use`, open Local Assist, confirm the picker and availability both show E4B, then run a
   Japanese generation through Proposal → Diff → explicit Apply → Undo.
7. Quit and relaunch. Confirm E4B restores as available and can generate again without another
   download.
8. With no generation active, delete E4B, confirm System is selected and E4B is no longer ready,
   then download and verify it again.

Record download failure/retry, disk-space behavior, first-load duration, peak memory, cancellation,
Japanese IME, VoiceOver, and the exact TestFlight build/asset-pack version separately. This document
does not claim those device checks have passed.
