# DMG Preview Checklist

Status: Operational
Scope: Warning-expected DMG preview distribution
Authority: Medium
Last reviewed: 2026-06-18

This checklist is for a warning-expected binary DMG preview lane only. It was used for the `v0.2.0-pre.0`, `v0.2.0-pre.1`, `v0.2.0`, `v0.3.0`, `v0.4.0`, `v0.18.0`, and `v0.20.0` warning-expected DMG previews and remains the current boundary for similar preview releases. Current GitHub Release DMG builds require Developer ID Application signing, but remain warning-expected until notarization and stapling are added as a separate lane.

Do not attach the DMG to the source-only GitHub Release. Do not create tags, push commits, publish a GitHub Release, or attach assets without explicit approval.

## Boundary

There are two different DMG lanes:

- Warning-expected DMG preview: a downloadable `.dmg` that packages the Developer / GitHub app, requires Developer ID Application signing for release assets, and clearly states that it is not notarized.
- Notarized DMG: a distribution-grade lane that adds notarization, stapling, and Gatekeeper verification on top of Developer ID signing.

Do not mix these lanes in release notes.

## Warning-expected DMG Preview

Use this only if the user explicitly approves moving from source-only release to DMG preview.

The current preview artifact is for macOS Apple Silicon / `aarch64`. It is not a universal or x64 DMG preview unless a separate artifact is built and verified.

Required work:

- Keep the release marked as developer preview.
- Use the repo-local warning-expected DMG preview script instead of the Tauri Finder-layout DMG path.
- Confirm a valid `Developer ID Application` identity exists locally. If multiple identities are installed, set `HAZAKURA_DEVELOPER_ID_IDENTITY` to the exact identity.
- Run the source-release P0 gates from `docs/source-release-checklist.md`.
- Build the app and DMG from a clean lockfile install.
- Verify the generated `.app` launches from the built bundle.
- Verify the generated `.dmg` with `hdiutil verify`.
- Mount the `.dmg`, copy or open the contained app as a user would, and run a minimal built-app smoke.
- Generate a SHA-256 checksum for the `.dmg`.
- Record the DMG filename, checksum, app version, and smoke result in `docs/current-status.md`.
- Update release notes to say the DMG is Developer ID signed, not notarized, and may still show macOS security warnings.

Suggested commands, adjusted to the actual generated paths:

```bash
npm ci
npm run build:vite
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npm run build:dmg-preview
codesign -dv --verbose=4 "src-tauri/target/release/bundle/macos/Hazakura Editor Dev.app" 2>&1 | grep "Authority=Developer ID Application:"
cd src-tauri/target/release/bundle/dmg
shasum -c hazakura-editor-dev_<version>_<arch>-warning-expected.dmg.sha256
```

`npm run build:dmg-preview` deliberately uses `hdiutil create` with a plain app-plus-Applications-link layout. Do not use `npm run build -- --bundles app,dmg` for this lane unless the Finder/AppleScript layout path is separately re-verified in the current environment.

Do not claim this path is notarized, stapled, Gatekeeper-clean, installer-grade, or production-ready.

## Notarized DMG

Treat this as a later distribution-readiness project, not a small source-preview follow-up.

Required decisions before implementation:

- Hardened runtime and entitlement review.
- Notarization workflow with `notarytool`.
- Stapling and offline Gatekeeper verification.
- Release asset naming, checksum, and rollback policy.

Reference Apple docs before starting this lane:

- https://developer.apple.com/developer-id/
- https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution
- https://support.apple.com/guide/mac-help/open-a-mac-app-from-an-unknown-developer-mh40616/mac

## Stop Conditions

Stop and do not attach a DMG to a release if:

- The release is still described as source-only.
- The `.dmg` cannot be verified or mounted.
- The app cannot launch from the packaged DMG.
- The release notes imply notarization, stapling, or Gatekeeper-clean distribution when those checks were not performed.
- The app inside the DMG is not signed by a `Developer ID Application` identity.
- The checksum is missing.
- The user has not explicitly approved binary asset publication.
