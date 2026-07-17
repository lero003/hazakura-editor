# External Code Review Brief — Theme G Media Boundaries (v1.13)

Status: Reviewed; two boundary fixes applied before packaging
Scope: Theme G M0–M4 source (post-published `1.12.0`)
Date: 2026-07-17
Audience: Outside code/security/product reviewer (not App Store submission)

## Product / release target

- **Product:** Hazakura Editor (macOS, Markdown-first Safe Editor)
- **Published baseline (immutable):** Mac App Store / source tag **`1.12.0`**
- **Development line:** package version **`1.13.0`** (refinement, not a store claim)
- **Slice under review:** Theme G — Image / Media Boundaries
  Plan: `docs/v1.xx-image-media-boundary-plan.md`
  Parent mode: `docs/v1.13-plus-refinement-roadmap.md`

## Current git state (fill at review time)

```bash
git status --short --branch
git log --oneline v1.12.0..HEAD | head -40
```

Expected Theme G commits (names may grow if amended later):

- `feat(v1.13): Theme G M0 — 画像ブロック理由と次アクションを明示`
- `feat(v1.13): Theme G M1–M3 メディア境界 — 同意付きローカルとリモート`
- `feat(v1.13): Theme G M4 — assets 固定 palette と smoke チェックリスト` (this closeout)
- plus any rustfmt / follow-up fix commits

## Intent (what “done” means)

Make **real manuscript image friction** solvable without abandoning Safe Editor:

| Goal | Default safety |
|---|---|
| Honest why Preview blocked an image | Always |
| `../assets` when workspace is cut too deep | **Ask** consent (parent folder), not silent open |
| Occasional `https` figures | Preference **Off**; https only when On |
| Export packages self-contained when possible | Materialize **On**; no silent source rewrite |
| Durable workspace-relative assets | Explicit palette pin + **one Undo**, never auto-save |

Hard rails (must not regress):

- No background image crawl / startup fetch of all Markdown images
- No arbitrary absolute path open without consent / approved roots
- No silent Markdown rewrite; pin is explicit
- No remote default On; **http** never auto-fetched
- OKF review / Assist / Agent do not gain image fetch as a side channel
- App Store lane must not claim “loads any URL by default”

## What was implemented

### M0 — Honesty

- Classified block reasons: `outside-workspace` | `absolute-outside` | `remote` |
  `unsupported-scheme` | `unsafe-data` | `invalid-src` | `missing-context` | `load-failed`
- Preview / e-book / export placeholders: title + reason + next action
- Stable attrs: `data-hazakura-image-block`, `-alt`, `-ref`, `-resolved-path`

### M1 — Outside-local consent

- Preferences: outside images **ask (default) / allow all within OS access**
- Approve control on blocked note: parent folder of the resolved path
- One controller-owned approval state is shared with Preview and export; ask
  approval is scoped to the current open tab and is never persisted
- Rust: `open_local_image_under_roots(path, allowed_roots)` — canonical containment

### M2 — Remote Preference

- Preferences: load remote in Preview **default Off** + privacy hint
- Rust: `fetch_remote_image` — **https only**, timeout, size, magic-bytes MIME
- CSP unchanged for direct remote img (fetch → data URL)

### M3 — Export materialize

- Preferences: materialize on export **default On**
- HTML / PDF / EPUB use mediaAccess loaders when materialize allows
- Remote embed only if **both** materialize On and remote Pref On
- Source Markdown unchanged by export alone

### M4 — Pin to assets

- Command Palette: `file.pinExternalImages`
  - JA: 外部画像を assets に固定…
  - EN: Pin external images into assets…
  - kana: そとの がぞうを assets に こてい…
- Copies via `import_image_from_path` / `save_pasted_image` (+ remote fetch for https)
- Applies rewrite through `EditorPane.replaceDocumentContents` (one Undo)
- Status: pinned/skipped/warnings; “save to keep on disk”
- Disabled without active tab or workspace

## Primary code / docs surfaces

| Area | Paths |
|---|---|
| Policy / classify | `src/features/editor/imagePolicy.ts`, `mediaImageSettings.ts`, `mediaImageApprovals.ts` |
| Render / inline | `src/features/editor/markdown.ts`, Preview/EBook panes |
| Pin | `pinExternalImages*.ts`, `usePinExternalImagesAction.ts`, `EditorPane.replaceDocumentContents` |
| Rust | `src-tauri/src/commands/images.rs` (`open_local_image_under_roots`, `fetch_remote_image`) |
| Prefs UI | `SettingsPreferencesPane` + `lib/locale/preferences.ts` |
| Palette | `commandPalette.ts`, `useCommandPaletteController.ts` |
| Security | `docs/security-boundary.md` |
| Smoke | `docs/smoke-checklist.md` § **Theme G Media Boundaries Smoke** |
| Plan | `docs/v1.xx-image-media-boundary-plan.md` |

Dependency: `ureq` added for bounded https fetch (`src-tauri/Cargo.toml` / lockfile).

## Verification performed (agent)

Run near closeout (re-run after final commit):

```bash
npm run typecheck
npm test
npm run build:vite
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

**Not claimed:**

- Packaged / TestFlight / VoiceOver spoken smoke (manual checklist exists, not executed here)
- App Store review submission of `1.13.0`
- Network live fetch of real third-party hosts in CI (unit tests pin https-only rejection of `http`)

## Known gaps / residual risk

1. **Hands-on smoke** is the main remaining evidence gap — use Theme G section in `docs/smoke-checklist.md`.
2. The remembered-folder branch and its clear button were removed after hands-on
   feedback showed workspace-global approval was too easy to misread.
3. Remote On path: first-network UX and failure copy should be judged on a real host; timeout/size tests exist in Rust path but full e2e network is host-dependent.
4. Pin of many images is sequential; no cancel UI mid-pin.
5. L Mode image widget still uses its own classifier (preview is the primary Theme G surface).
6. `open_image_file` (image tab path) remains a separate disk open path for references — do not confuse with Markdown Preview policy.

## Review outcome (2026-07-17)

- Fixed the native redirect gap: remote image requests no longer follow redirects,
  so an initial `https` URL cannot traverse an intermediate `http` hop. Redirects
  fail soft and ask the user to use the final `https` URL.
- Added a warning confirmation before palette pin performs its first remote fetch
  while Preview remote loading is Off. Declining performs no network request and
  leaves source/assets unchanged.
- Parent-folder approval remains the deliberate manuscript-sized scope. Rust
  canonical containment is still defense in depth around roots supplied by the
  trusted main-window frontend; it is not a durable OS bookmark boundary.

## Review focus (please stress these)

1. **Consent model:** Does ask reset on a newly opened tab? Is explicit allow-all
   clearly separate from remote URL permission?
2. **Rust gates:** Can FE spoof `allowed_roots` to open arbitrary files? (Expected: only paths under provided roots after canonicalize; still requires FE to pass roots — is that acceptable for this trust model?)
3. **Pin vs Preview:** Pin may fetch remote / import outside paths even when Preview remote is Off (explicit command). Is that the right product call?
4. **Export:** Can materialize On + remote Off still leak network? (Expected: no.)
5. **Source integrity:** Any silent rewrite path outside pin + Undo?
6. **i18n / a11y:** Approve control is `role="button"` span (DOMPurify forbids `<button>`). Keyboard Enter/Space + focus?
7. **Claims:** Docs/security-boundary language vs implementation — any over-claim for App Store?

## Questions for reviewer

1. Approve **parent folder** (not single file) — too wide, too narrow, or right for manuscripts?
2. Should pin require an extra confirm dialog when remote fetch is needed?
3. Should `http` ever be allowed behind a stronger warning, or forever blocked?
4. Is one palette command enough, or should blocked-note also offer “pin this image”?
5. Any security-boundary paragraph you would require before shipping a `1.13.x` box?

## Current recommendation

- **Source Keep for Theme G M0–M4** as a v1.13 refinement candidate, **pending**:
  - external review findings on consent/path/network, and
  - at least one pass of packaged Theme G smoke checklist.
- **Do not** reopen or mutate published **`1.12.0`** for this work.
- Treat version **`1.13.0`** as a shipping box only after Keep evidence + human go.

## Paste-ready summary for the reviewing agent

```text
Please review Hazakura Editor Theme G media boundary work (v1.13 development line).
Baseline published 1.12.0 is immutable. Plan: docs/v1.xx-image-media-boundary-plan.md.
Brief: docs/archive/reviews/theme-g-media-boundary-external-review-brief-2026-07-17.md.
Smoke: docs/smoke-checklist.md § Theme G Media Boundaries Smoke.
Focus: consent (outside-local ask/allow, no remembered folders), Rust path/image
checks + https-only fetch,
export materialize without source rewrite, palette pin + one Undo, no silent network.
Defaults must stay safe (remote Off). Report bugs/boundary gaps before polish nits.
```
