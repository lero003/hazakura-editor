# Core AI Apple-hosted E4B handoff

Status: First TestFlight upload rejected for a nested extension entitlement; fixed and rebuilt, upload pending
Scope: Internal TestFlight path for Gemma 4 E4B only
Authority: Verification record
Last reviewed: 2026-09-21

## Fixed identifiers

| Item | Identifier |
| --- | --- |
| Main app | `dev.hazakura.editor` |
| Background Download extension | `dev.hazakura.editor.background-downloader` |
| Shared App Group | `group.dev.hazakura.editor` |
| E4B asset pack | `hazakura-coreai-gemma4-e4b-v1` |
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
scripted Tauri submission path embeds both profiles immediately before the final nested and app
signatures. It validates `OSX`, the exact application identifier, the shared App Group, expiry, and
the distribution debug setting before building. The default local ignored paths are:

```txt
src-tauri/profiles/Hazakura_Editor_Mac_App_Store_Profile.provisionprofile
src-tauri/profiles/Hazakura_Background_Downloader_Mac_App_Store_Profile.provisionprofile
```

Alternative local names can be selected with `HAZAKURA_APP_STORE_MAIN_PROFILE` and
`HAZAKURA_BACKGROUND_DOWNLOADER_PROFILE`. The first two profiles supplied on 2026-09-21 had mobile
platforms and were correctly rejected. Their replacements pass `OSX`, exact application identifier,
shared App Group, expiry, and distribution checks for both targets. Their embedded certificate
matches an installed Apple Distribution identity. The same host also has a matching Mac App Store
installer identity. Do not commit profiles, certificates, or private keys.

The 3.1.0 build 143 candidate was created from clean source commit `a9ed2d57`. The universal app,
extension, and three helpers pass deep signature and required-entitlement checks. The installer pkg
passes `pkgutil --check-signature`; its SHA-256 is recorded in the ignored candidate metadata.
Transporter upload and Apple processing have not been attempted. A local `spctl` rejection is not
an App Store validation failure because Gatekeeper evaluates the outside-the-Store Developer ID
lane; use Transporter or `altool --validate-app` for upload validation.

### First upload attempt: extension signature (error 90886)

Build 143 uploaded but Apple rejected it for TestFlight:

```txt
Cannot be used with TestFlight because the signature for the bundle at
“Hazakura Editor.app/Contents/Extensions/HazakuraBackgroundDownloader.appex” is missing an
application identifier but has an application identifier in the provisioning profile for the
bundle. (90886)
```

The cause was local. `codesign` does not read the embedded provisioning profile, and the
extension was signed with `BackgroundDownloader.entitlements`, which only listed
`com.apple.security.app-sandbox` and `com.apple.security.application-groups`. The main app's
entitlements file already carried `com.apple.application-identifier` and
`com.apple.developer.team-identifier`; the extension's did not, so the signature did not match
the profile it embedded.

`scripts/sign-app-store-submit-app.mjs` now derives both values from the profile it validates and
signs the extension with that merged set, then reads the signed entitlements back with `codesign -d`
and fails if the application identifier or team identifier is missing or different.
`REQUIRE_APP_STORE_ENTITLEMENTS=1 npm run probe:macos-distribution -- <app-path>` reports the same
condition. Re-running the fixed signing step on the build 143 bundle produced
`8BNUB2R9C8.dev.hazakura.editor.background-downloader` in the extension signature, and the full
App Store entitlement probe passed. Apple-side acceptance still requires a new upload.

Build 143 cannot be repaired in App Store Connect: the same build number cannot be re-uploaded, so
a replacement candidate with a higher `CFBundleVersion` is required. Build 144 was rebuilt from the
fixed signing step, passed the full App Store entitlement probe, and Apple delivered and processed
it without repeating 90886, so the entitlement fix is confirmed end to end. Build 145 then replaced
it because the asset pack identifier changed (see below). Candidate paths, digests, and source
commits live in the ignored candidate metadata.

## `.aar` status

`npm run coreai:ba-package:reproduce` isolates packaging from all model scripts. On this host:

```txt
macOS 27.0 (26A428)
Xcode 27.0 (27A266a)
ba-package 2.0
```

An earlier revision of this record concluded that this toolchain rejects Apple's documented `.json`
manifest input and blocked the archive on a corrected `ba-package`. That conclusion was wrong: the
failure depends on the execution context, not the toolchain. The same 41-byte fixture and the same
absolute `.json` output path fail with exit 64 and `path extension isn’t “json”` while `ba-package`
runs inside the Codex seatbelt sandbox (`CODEX_SANDBOX=seatbelt`), and succeed from Terminal.app.
`env -i` with a minimal environment does not change the sandboxed result, so this is not an
inherited-variable effect either. The reproduction script now records the sandbox indicators and
classifies that case as `restricted-execution-environment` instead of a toolchain defect. Running
the same comparison outside the sandbox produces no failure for any CLI form.

The manifest schema was checked against the tool itself: `xcrun ba-package template` was saved and
compared, and the pinned `directorySource` / `directoryDestination` / `sourceRoot` keys are the
current documented keys. `sourceRoot` resolves relative to the manifest's location, which matches
the generated layout.

One behavioural detail was worth fixing: `ba-package` changes its working directory to `sourceRoot`
before it resolves the output path. `buildBaPackageCommands` therefore hands it absolute manifest
and archive paths; with relative arguments the archive lands inside the payload stage even when
packaging succeeds, and the following `stat` fails.

Running the packaging step outside the sandbox succeeded for both candidates on 2026-09-21:

| Model | `.aar` | bytes | SHA-256 |
| --- | --- | --- | --- |
| Gemma 4 E4B | `hazakura-coreai-gemma4-e4b-v1.aar` | 5,431,767,276 | `394c5eb92f334294a91ddb360117c5af8862fc36220293b5e56a8d409802aaa8` |
| Gemma 4 12B | `hazakura-coreai-gemma4-12b-v1.aar` | 9,148,928,735 | `fa1f052b705dad60e0ddac8cdfdb98ec1c6a309add11edc99dc141de224b682f` |

Both archives live under `.hazakura/coreai-production/<key>/2026.09.20.1/archives/` together with
`archive.json` and `UPLOAD-INSTRUCTIONS.md`, and remain untracked:

```txt
.hazakura/coreai-production/gemma4-e4b/2026.09.20.1/archives/
├── hazakura-coreai-gemma4-e4b-v1.aar
├── archive.json
└── UPLOAD-INSTRUCTIONS.md
```

Local archive generation is not Apple upload, Apple processing, signed-build, or device evidence.

The App Store Connect asset-pack version is assigned and incremented by Apple at upload time. It is
not the catalog revision and cannot be reported before a successful upload/processing result.

### First asset pack upload attempt

Uploading the first `.aar` through Transporter failed before the pack was accepted:

```txt
Apple ID “6778637880”のアセットパックのリストを取得できませんでした。 (-19243)
There is an error with a URL parameter (400)
Found invalid values: dev.hazakura.editor.coreai.gemma4-e4b.v1（ID: 24aab909-066f-44c6-88bd-0b0df823ebe1）
```

The root cause is the identifier string, not the archive, the app record, or the account role.
`altool` reproduced it against the live API on 2026-09-21:

```txt
$ xcrun altool --list-asset-packs --apple-id 6778637880 --api-key <key-id> --api-issuer <issuer-id>
= Apple ID: 6778637880        (succeeds; the app has no asset packs yet)

$ xcrun altool --list-asset-pack-versions --apple-id 6778637880 \
    --asset-pack-identifier dev.hazakura.editor.coreai.gemma4-e4b.v1 ...
400 PARAMETER_ERROR  Found invalid values: dev.hazakura.editor.coreai.gemma4-e4b.v1
  source.parameter: filter[assetPackIdentifier]

$ xcrun altool --list-asset-pack-versions --apple-id 6778637880 \
    --asset-pack-identifier Tutorial ...
No background asset pack versions found for 'Tutorial'.
```

App Store Connect rejects a period inside `assetPackIdentifier`. The same probe accepted `Tutorial`,
`a-b`, and `hazakura-coreai-gemma4-e4b-v1`, and rejected `a.b`, `com.example.tutorial`, and every
dotted variant of this pack. Hyphens, digits, uppercase, and long names are accepted. Neither
Apple's Background Assets article nor the App Store Connect OpenAPI specification documents this
rule; it was established by probing the live filter parameter.

The pack identifier therefore changed to a hyphen-only name, and the lock now rejects periods:

| | Old | New |
| --- | --- | --- |
| E4B asset pack | `dev.hazakura.editor.coreai.gemma4-e4b.v1` | `hazakura-coreai-gemma4-e4b-v1` |
| 12B asset pack | `dev.hazakura.editor.coreai.gemma4-12b.v1` | `hazakura-coreai-gemma4-12b-v1` |

`scripts/core-ai-production-models.json`, `E4B_ASSET_PACK_ID` in
`src-tauri/src/commands/core_ai_models.rs`, the regenerated archives, and the documentation all use
the new identifier. The dotted archives were regenerated and the stale ones deleted so the invalid
identifier cannot be uploaded by accident. The old identifier was never uploaded, so no App Store
Connect record needs archiving.

The Transporter/iTMSTransporter/`altool` upload path is otherwise unchanged: the pack is uploaded
independently of the app build, and the Asset Pack ID plus the app identify it.

## Local verification

- `npm run coreai:models:verify -- --model=gemma4-e4b`: 12 files and 6,807,926,119 expanded
  bytes match the production lock. The generated payload resource manifest exactly matches the
  signed runtime resource and its SHA-256 is
  `d46c81f18147a2faf0d066b4ef2d31f72416b75ee544397580815fa2e4fb4af3`.
- `npm run coreai:ba-package:reproduce`: the minimal fixture fails with
  `path extension isn’t “json”` inside the Codex sandbox and reports
  `restricted-execution-environment`; the same script outside the sandbox shows no failure.
- `npm run coreai:models:package -- --model=gemma4-e4b` and `--model=gemma4-12b` outside the
  sandbox created both `.aar` files listed above, with `archive.json` digests that match a
  re-computed SHA-256.
- `npm run typecheck`, `npm run build:vite`, and `npm test`: pass. Vitest reports 295 files and
  2,646 tests; the production-model and provisioning-profile scripts report another 15 tests
  (14 before the sandbox-detection case and the absolute-path argument guard were added).
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

After the archive exists:

1. From a normal shell (outside the Codex sandbox), run
   `npm run coreai:models:package -- --model=gemma4-e4b`; retain the `.aar`, `archive.json`,
   resource manifest, and digest together.
2. Upload only `hazakura-coreai-gemma4-e4b-v1.aar` with Transporter, App Store Connect API,
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
