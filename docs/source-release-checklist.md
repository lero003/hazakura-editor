# Source Release Checklist

Status: Draft
Scope: Source-only release readiness
Authority: High
Last reviewed: 2026-05-27

This checklist is for a source-only developer preview release of `hazakura-note`.

Source-only means publishing the repository state, tag, source archive, release notes, and build instructions. It does not mean distributing a signed or notarized macOS app.

## Release Boundary

In scope:

- Source tag readiness
- README build-from-source clarity
- Version alignment across `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`
- Local quality gates
- Manual smoke evidence for core editor safety
- Known limits and preview wording
- Release notes for a developer-preview source release

Out of scope:

- Apple Developer ID signing
- Notarization
- Installer packaging
- Auto-update
- Git integration inside the app
- LSP, terminal, plugin, or AI features
- Binary asset publication unless a later release goal explicitly approves it

## Required Local Gates

Run from the repository root:

```bash
npm run build:vite
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
git diff --check
```

The Vite chunk-size warning is acceptable for the source preview if it is still listed in known limits.

## Required Manual Smoke Evidence

Use the built app and record concise evidence in `docs/current-status.md` before tagging:

- New File creates a new file and refuses to overwrite an existing file
- Open -> Edit -> Save writes expected text
- CRLF and final-newline preservation survive save
- External-change conflict stops overwrite
- Non-conflict save failure keeps local edits and offers recovery
- Dirty-tab close and app/window close preserve unsaved changes when cancelled
- Search highlights, Enter / Shift+Enter movement, and Escape return-to-editor work
- Japanese IME composition does not trigger editor shortcuts
- Lazy workspace tree opens a large throwaway workspace, loads expanded directories on demand, hides excluded directories, and shows partial listing when a folder exceeds the cap
- Theme switching keeps editor cursor/selection and undo/redo session state

## Version And Release Notes

Before tagging:

- Confirm `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml` carry the intended version.
- Add or update release notes for the source preview.
- State clearly that users build from source with `npm install` and `npm run build`.
- State clearly that the built local app is unsigned and not notarized.
- Keep known limits visible in `README.md` and `docs/current-status.md`.

## Stop Conditions

Do not tag a source release if:

- Any required local gate fails.
- The app cannot build locally.
- Current docs imply signed/notarized app distribution.
- Source build instructions are missing or misleading.
- Manual smoke evidence for file safety is absent.
- The working tree contains unrelated uncommitted changes.
