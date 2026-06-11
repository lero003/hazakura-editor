# Release Pre-Check

Status: Operational
Scope: Last-mile hygiene check before tagging, publishing, or attaching binaries
Authority: Medium
Last reviewed: 2026-06-12 (bundled third-party notices)

This checklist runs **immediately before** tagging a source / local-app tag or attaching a warning-expected DMG to a GitHub Release. It does not replace the P0 gates in `docs/source-release-checklist.md` or `docs/dmg-preview-checklist.md`; it sits one step above them as a hygiene pass for things that would be embarrassing on a public surface.

The check is intentionally small and grep-based so an agent can run it on a release-candidate worktree in a few minutes. It is a one-shot scan, not a continuous monitor.

## What This Check Covers

Three concerns that are easy to miss in code / docs work but are very visible once a tag or release is public:

1. **Hard-coded local paths** — `/Users/...`, `/tmp/...`, `/var/folders/...`, `/home/...`, Windows-style `C:\Users\...`, or other machine-specific paths that would point readers to the author's own filesystem.
2. **Inappropriate GitHub content** — personal names, organization-internal paths, machine temp paths, TODO-style developer scratch notes, or other surface that should not appear in a public release note / status doc.
3. **Security concerns** — API keys, tokens, passwords, AWS / GCP / Azure credentials, private keys, internal hostnames, internal IPs, or other secret-bearing strings.
4. **Bundled license notices** — generated macOS app bundles should carry the app license and third-party notice files under `Contents/Resources/`.

## How To Run

Run from the repository root, scoped to the release-candidate range.

### Scope The Diff

```bash
# Find the previous release tag and the release-candidate HEAD.
git log --oneline <previous-tag>..<release-candidate-head>
```

Then run each grep below against `git diff <previous-tag>..<release-candidate-head>`. Scoping to the diff keeps the noise low and the result reproducible.

### 1. Local Paths

```bash
git diff <previous-tag>..<release-candidate-head> | \
  grep -E "^\+.*(/Users/|/home/|/private/|/var/folders/|/tmp/[a-zA-Z0-9_-]+|C:\\\\Users\\\\)" | \
  head -20
```

Expected: empty. Anything that does show up is either a real hard-code (must fix) or a smoke-evidence reference in `docs/releases/` (acceptable only if it was already public before).

If the diff is too noisy, scope to a path prefix:

```bash
git diff <previous-tag>..<release-candidate-head> -- docs/ src/ | \
  grep -E "^\+.*(/Users/|/tmp/hazakura|/var/folders/)" | head -20
```

### 2. GitHub Inappropriate Content

```bash
git diff <previous-tag>..<release-candidate-head> | \
  grep -E "^\+.*(\\b(TODO|FIXME|XXX|HACK)\\b|developer note|internal-only|not for review|keisetsu|lero003)" | \
  head -20
```

Expected: empty for source / docs files. References to the public repository name (`lero003/hazakura-editor`) inside `docs/releases/` are fine; the grep above is a signal-only filter, not a hard fail. Verify the hits manually.

### 3. Security Concerns

```bash
git diff <previous-tag>..<release-candidate-head> | \
  grep -iE "^\+.*(api[_-]?key|secret|\\btoken\\b|password|passwd|bearer|aws[_-]|private[_-]?key|BEGIN [A-Z]+ PRIVATE|192\.168\.|10\.[0-9]+\.|172\.(1[6-9]|2[0-9]|3[01])\.|internal\.|corp\.|localhost:[0-9])" | \
  head -20
```

Expected: empty. Any hit is a stop condition. Review the file, remove the secret, and rotate the credential if it ever reached a remote.

### 4. Whole-Repository Audit (Pre-Publish Only)

The diff-scoped greps above are the primary check. As a second pass, audit the whole repository for things that may already be tracked and would have slipped past the diff scope (e.g. long-lived `docs/archive/` entries):

```bash
# Hard-coded paths in docs / README / AGENTS.md
grep -rnE "/Users/|/home/keisetsu|/var/folders/" README.md AGENTS.md docs/ 2>/dev/null | head -20

# Tokens / secrets in source
grep -rnE "api[_-]?key|secret|password|private[_-]?key" src/ src-tauri/src/ 2>/dev/null | head -20

# Verify .build / target / node_modules are git-ignored
git ls-files src-helpers/apple-assist/.build/ src-tauri/target/ node_modules/ 2>/dev/null | wc -l
```

Expected: zero tracked files under `src-helpers/apple-assist/.build/`, `src-tauri/target/`, and `node_modules/`. Long-lived docs entries under `docs/archive/` or `docs/releases/` are accepted as historical evidence and are not in this checklist's scope.

### 5. Bundled License Notices

After building a macOS app bundle, verify that the generated bundle
contains the packaged license and third-party notice files:

```bash
npm run probe:macos-distribution -- "src-tauri/target/release/bundle/macos/Hazakura Editor.app"
```

Expected: the `== bundled notices ==` section reports both
`LICENSE: present` and `THIRD_PARTY_NOTICES.md: present`.

## Stop Conditions

Do not tag or attach a binary if any of the following are true:

- The diff-scoped grep in section 1 returns a non-empty result and the hit is not already-public release evidence in `docs/releases/`.
- The diff-scoped grep in section 2 returns a non-empty result that is not the public repository name `lero003/hazakura-editor` in `docs/releases/`.
- The diff-scoped grep in section 3 returns a non-empty result of any kind. Rotate the credential before continuing.
- The whole-repo audit in section 4 surfaces new secrets or new local paths that the diff-scoped greps missed.
- The bundled notice check in section 5 reports a missing or empty `LICENSE` or `THIRD_PARTY_NOTICES.md`.

When a stop condition fires, fix the issue in the release-candidate worktree and re-run this entire checklist before tagging or publishing.

## Last Run: v0.18.0 (2026-06-12)

Range: `v0.17.0..release-candidate worktree` before tagging.

Result:

- Section 1 (local paths in diff): hits were limited to test fixtures
  such as `/tmp/standalone.md`, `/tmp/outside/keep.md`, and
  `/private/tmp/outside/keep.md`, plus normalization logic that maps
  `/private/tmp` / `/private/var` aliases. No product code or public
  release prose gained a new machine-specific author path.
- Section 2 (inappropriate GitHub content in diff): hits were limited
  to public `lero003/hazakura-editor` release-note / README links. No
  new developer scratch note or private organization wording was added.
- Section 3 (security concerns in diff): the only hit was a code
  comment mentioning a parser token. No token, API key, password,
  private key, internal IP, or internal hostname was added.
- Section 4 (whole-repo audit): long-lived `/Users/...` examples remain
  under archive / checklist history, and source hits for
  `secret-looking` / `token` were diagnostics redaction tests or
  sanitizer wording. Zero tracked files were found under
  `src-helpers/apple-assist/.build/`, `src-tauri/target/`, or
  `node_modules/`.
- Section 5 (bundled notices): `npm run probe:macos-distribution -- "src-tauri/target/release/bundle/macos/Hazakura Editor.app"`
  passed with both `LICENSE` and `THIRD_PARTY_NOTICES.md` present.

DMG and source files referenced in v0.18.0
(`src-tauri/target/release/bundle/dmg/hazakura-editor-dev_0.18.0_aarch64-warning-expected.dmg`
and `*.dmg.sha256`) are build outputs under `src-tauri/target/`, which
is `.gitignore`d. They were generated and verified locally, but not
committed to the repository.

## Last Run: v0.17.0 (2026-06-10)

Range: `v0.16.0..HEAD` plus the current release-candidate worktree
before tagging.

Result:

- Section 1 (local paths in diff): hits were limited to explicit
  privacy / diagnostics / close-flow test fixtures such as `/Users/leak`
  and `/tmp/missing-tab.md`.  Human-authored docs that had contained the
  local repository path were normalized before tagging.
- Section 2 (inappropriate GitHub content in diff): hits were limited
  to public `lero003/hazakura-editor` release-note references.  No new
  developer scratch note or private organization wording was added.
- Section 3 (security concerns in diff): hits were limited to
  diagnostic/privacy wording and tests that assert secret-looking fields
  are not collected.  No token, API key, password, private key, internal
  IP, or internal hostname was added.
- Section 4 (tracked build outputs): zero tracked files under
  `src-helpers/apple-assist/.build/`, `src-tauri/target/`, or
  `node_modules/`.

DMG and source files referenced in v0.17.0
(`src-tauri/target/release/bundle/dmg/hazakura-editor-dev_0.17.0_aarch64-warning-expected.dmg`
and `*.dmg.sha256`) are build outputs under `src-tauri/target/`, which
is `.gitignore`d.  They were generated and verified locally, but not
committed to the repository and not uploaded as GitHub Release assets.

## Last Run: v0.16.0 (2026-06-08)

Range: `v0.15.0..HEAD` (v0.16.0 L Mode Live Source quality follow-up + per-surface font sizes + release-prep alignment slice).

Result:

- Section 1 (local paths in diff): hits were limited to this checklist's own example patterns and its historical-audit note. No product code, release note, README, or runtime path gained a new machine-specific path.
- Section 2 (inappropriate GitHub content in diff): hits were limited to this checklist's own grep examples and public repository references in release evidence. No new developer scratch note or private organization wording was added.
- Section 3 (security concerns in diff): hits were limited to this checklist's own grep examples. No token, API key, password, private key, internal IP, or internal hostname was added.
- Section 4 (whole-repo audit): the long-lived entries under `docs/archive/` (e.g. `docs/handoff.md`, `docs/source-release-checklist.md`, and past `docs/releases/0.x.0-*.release.md`) still contain `/Users/keisetsu/...` and `/tmp/hazakura-note-...` references from previous smoke runs. They are accepted as historical release evidence and are not in this checklist's scope for v0.16.0. A future `docs/` archive tidy-up slice can normalize those references to anonymous paths if desired, but it is not a v0.16.0 release blocker.

DMG and source files referenced in v0.16.0 (`src-tauri/target/release/bundle/dmg/hazakura-editor-dev_0.16.0_aarch64-warning-expected.dmg` and `*.dmg.sha256`) are build outputs under `src-tauri/target/`, which is `.gitignore`d. The DMG and SHA-256 will be attached to the GitHub Release as release assets, not committed to the repository.

## Related Documents

- `docs/source-release-checklist.md` — source / local-app tag P0 gates.
- `docs/dmg-preview-checklist.md` — warning-expected DMG preview P0 gates.
- `docs/security-boundary.md` — durable security boundary for the app itself (separate concern; this checklist is about release hygiene, not app behavior).
- `AGENTS.md` — working rules, including the "release prep follows `docs/release-pre-check.md`" reference.
