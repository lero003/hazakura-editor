# Release Review Request - v0.6.0 preparation

この文書は hazakura-note v0.6.0 のリリース準備と公開結果を記録するための外部レビューブリーフです。
タグ作成・GitHub Release 公開・リモート asset 検証は完了しています。

---

## Project / Release Target

| Item | Value |
|---|---|
| Project | hazakura editor (renamed from hazakura-note for v0.6 release prep) |
| Current documented public preview | v0.6.0 warning-expected DMG preview |
| Current version surfaces | `0.6.0` in npm, Tauri, and Cargo metadata |
| Candidate version | **v0.6.0** |
| Current branch | `main`; push target is `https://github.com/lero003/hazakura-editor.git` |
| Release URL | https://github.com/lero003/hazakura-editor/releases/tag/v0.6.0 |

## Release Intent

v0.6 is the **Foundation Release / Daily-Drivable Safe Editor** checkpoint.
The purpose is not to add another broad feature wave; it is to stop the large
App.tsx refactor at a useful boundary, verify the implemented v0.6 behavior,
and prepare the warning-expected DMG preview lane.

Keep the product boundary intact:

- Safe Editor remains primary.
- Agent Workbench remains optional and explicitly gated.
- No Context/zustand migration, UI refresh, Agent Workbench rewrite, or v0.7 feature work belongs in this release prep.

## Implemented Scope To Review

- App.tsx responsibility split into focused hooks and shell components.
- Cmd+P Quick Open.
- Workspace auto-backups for dirty tabs, with Preferences > Application ON/OFF.
- Replace one / Replace all fixes, including empty replacement text.
- Agent output differential polling and selected-text send behavior.
- Preset Agent prompt chips.
- Pointer-based tab drag/reorder behavior.
- Multi-cursor and rectangular selection support.
- Markdown/image/export stability work carried forward from v0.5 follow-up.

## Local Checks Run In This Prep Pass

| Check | Result |
|---|---|
| `npm run typecheck` | Passed |
| `git diff --check` | Passed |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 85 tests |
| `npm run build` | Passed; Vite chunk-size warning remains expected |
| `npm audit --json` | Passed: 0 vulnerabilities |
| `cargo audit --file src-tauri/Cargo.lock --json` | Passed: 0 vulnerabilities; informational warnings remain for transitive GTK3/unic/proc-macro-error/glib crates |
| GitHub Dependabot alert #1 | Open: `GHSA-wrw7-89jp-8q8g` / `glib 0.18.5` in `src-tauri/Cargo.lock`; matches the known RustSec informational `glib::VariantStrIter` warning and is not treated as a macOS warning-expected preview blocker |
| `codesign --verify --deep --strict --verbose=2 "src-tauri/target/release/bundle/macos/hazakura editor.app"` | Passed |
| Built app bundle version inspection | Reports `0.6.0` / `lab.hazakura.note` / `hazakura editor` / `hazakura-editor` |
| `SKIP_BUILD=1 npm run build:dmg-preview` | Passed; generated `hazakura-editor_0.6.0_aarch64-warning-expected.dmg` |
| `shasum -c hazakura-editor_0.6.0_aarch64-warning-expected.dmg.sha256` | Passed |
| Mounted DMG app metadata and codesign | Passed |
| `spctl -a -vv -t open "src-tauri/target/release/bundle/macos/hazakura editor.app"` | Rejected with `source=Insufficient Context`, expected for warning-expected preview |
| Built-app focused UI smoke via Computer Use | Passed for launch, temp-file open/save, Export as HTML, split Diff comparison, tab drag reorder, previous/next tab focus, Replace all, Cmd+P Quick Open overlay, Preferences > Application auto-backup ON/OFF, and a real auto-backup write under `.hazakura/backups/` |
| Browser smoke | Not run: in-app Browser returned `Browser is not available: iab` in this session |
| Remote GitHub Release verification | Passed: downloaded published assets, `shasum -c` passed, `hdiutil verify` passed, mounted app metadata matched `0.6.0` / `lab.hazakura.note` / `hazakura editor` / `hazakura-editor`, and codesign verification passed |

## Known Pre-Release Gaps

1. GitHub Dependabot alert #1 remains open for `GHSA-wrw7-89jp-8q8g` / `glib 0.18.5`. This is a known transitive Tauri/wry GTK3-stack warning rather than a v0.6 macOS warning-expected preview blocker, but it should stay visible for future dependency-refresh review.

## Reviewer Focus

- Is the App.tsx refactor now a good enough v0.6 boundary, or should any remaining extraction be deferred to v0.7+?
- Are the v0.6 claims in README/current-status/roadmap narrower than the actual implementation?
- Confirm that the v0.6 release should use `hazakura editor` as the app-facing product name and `hazakura-editor` as the release artifact basename.
- Is the App.tsx split, name alignment, and focused built-app smoke evidence enough to approve tagging after commit review?

## Recommended Next Steps

1. Keep `v0.6.0` immutable.
2. Continue future work on `main` toward the next documented phase.

## Current Recommendation

v0.6.0 is released as a warning-expected prerelease.
The local code gates, dependency audits, GitHub alert triage, warning-expected DMG generation, checksum verification, mounted-app metadata check, codesign check, expected Gatekeeper rejection, focused UI smoke, publication, and remote asset verification pass.
