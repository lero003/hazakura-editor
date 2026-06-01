# Release Review Request - v0.6.0 preparation

この文書は hazakura-note v0.6.0 のリリース準備に入るための外部レビューブリーフです。
まだタグ作成・公開は行っていません。ローカルの warning-expected DMG 候補は生成・検証済みです。

---

## Project / Release Target

| Item | Value |
|---|---|
| Project | hazakura editor (renamed from hazakura-note for v0.6 release prep) |
| Current documented public preview | v0.4.0 warning-expected DMG preview |
| Current version surfaces | `0.6.0` in npm, Tauri, and Cargo metadata |
| Candidate version | **v0.6.0** |
| Current branch | `main`; push target is `https://github.com/lero003/hazakura-editor.git` |
| Worktree expectation | Clean after the v0.6 refactor/release-prep commit is staged and pushed |

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
| `cargo test --manifest-path src-tauri/Cargo.toml` | Passed: 82 tests |
| `npm run build` | Passed; Vite chunk-size warning remains expected |
| `npm audit --json` | Passed: 0 vulnerabilities |
| `cargo audit --file src-tauri/Cargo.lock --json` | Passed: 0 vulnerabilities; informational warnings remain for transitive GTK3/unic/proc-macro-error/glib crates |
| `codesign --verify --deep --strict --verbose=2 "src-tauri/target/release/bundle/macos/hazakura editor.app"` | Passed |
| Built app bundle version inspection | Reports `0.6.0` / `lab.hazakura.note` / `hazakura editor` / `hazakura-editor` |
| `SKIP_BUILD=1 npm run build:dmg-preview` | Passed; generated `hazakura-editor_0.6.0_aarch64-warning-expected.dmg` |
| `shasum -c hazakura-editor_0.6.0_aarch64-warning-expected.dmg.sha256` | Passed |
| Mounted DMG app metadata and codesign | Passed |
| `spctl -a -vv -t open "src-tauri/target/release/bundle/macos/hazakura editor.app"` | Rejected with `source=Insufficient Context`, expected for warning-expected preview |
| Built-app focused UI smoke via Computer Use | Passed for launch, temp-file open/save, Export as HTML, split Diff comparison, tab drag reorder, previous/next tab focus, Replace all, Cmd+P Quick Open overlay, Preferences > Application auto-backup ON/OFF, and a real auto-backup write under `.hazakura/backups/` |
| Browser smoke | Not run: in-app Browser returned `Browser is not available: iab` in this session |

## Known Pre-Release Gaps

1. Remote GitHub Release verification is not applicable yet because no v0.6 tag or assets exist.
2. GitHub reported 1 moderate Dependabot alert after the source push, while local `npm audit` and `cargo audit` found 0 vulnerabilities. Inspect the GitHub alert before tagging so the release decision records whether it is stale, informational, or actionable.

## Reviewer Focus

- Is the App.tsx refactor now a good enough v0.6 boundary, or should any remaining extraction be deferred to v0.7+?
- Are the v0.6 claims in README/current-status/roadmap narrower than the actual implementation?
- Confirm that the v0.6 release should use `hazakura editor` as the app-facing product name and `hazakura-editor` as the release artifact basename.
- Is the App.tsx split, name alignment, and focused built-app smoke evidence enough to approve tagging after commit review?

## Recommended Next Steps

1. Stop v0.6 refactoring here unless a release-blocking bug appears.
2. Review the pushed v0.6 refactor, rename, and release-prep commit.
3. Inspect the GitHub Dependabot alert and record the release decision.
4. Publish as a prerelease only after approval, then remote-download and verify the uploaded assets.

## Current Recommendation

Proceed to v0.6 release preparation, but do not tag or publish yet.
The local code gates, dependency audits, warning-expected DMG generation, checksum verification, mounted-app metadata check, codesign check, expected Gatekeeper rejection, and focused UI smoke now pass. Remaining work is source-branch review, GitHub alert triage, release approval, publication, and remote asset verification.
