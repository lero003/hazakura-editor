# App Store Performance & Bundle Baseline

Status: Recorded
Scope: queue 5 — `app-store-quality: performance-bundle-baseline`
Recorded: 2026-06-09
Version: 0.16.0

## Purpose

This document records a reproducible measurement baseline for the
App Store lane's production bundle (`npm run build:vite`). It is
NOT an optimisation plan — it is a snapshot so future work can
compare before/after without guesswork.

## Measurement Command

```bash
npm run build:vite
```

The build uses `tsc --noEmit && vite build` (see `package.json`).
Tauri-specific post-processing (code signing, DMG) is **not** part
of this baseline.

## Bundle Sizes (2026-06-09)

| Chunk | Raw (kB) | Gzip (kB) | Notes |
|---|---|---|---|
| `main` | 977.92 | 308.72 | Main window entry. The largest chunk. |
| `agent` | 353.91 | 90.57 | Agent Workbench window entry. Not in App Store lane. |
| `styles` (JS) | 214.47 | 66.57 | CodeMirror + editor theme JS |
| `styles` (CSS) | 126.83 | 21.29 | App shell + L Mode + preview CSS |
| `markdown` | 69.22 | 23.25 | **Lazy-loaded** (marked + DOMPurify). Only loaded when preview or export is used. |
| `apple-assist` | 22.73 | 7.16 | Hazakura Local Assist window entry |
| `agent` (CSS) | 3.93 | 1.01 | Agent window CSS |
| `useAgentProviderAvailability` | 4.45 | 1.88 | Provider availability probe |
| `PreviewPane` | 0.78 | 0.51 | Preview pane lazy-load shell |
| `useAppleAssistAvailability` | 0.42 | 0.30 | Hazakura Local Assist availability probe |
| `hazakura-mark.png` | 307.18 | — | Static asset |

### Chunk-size Warning

Vite warns about chunks > 500 kB raw:

```
(!) Some chunks are larger than 500 kB after minification.
```

Only `main` (978 kB raw) triggers this warning (agent is 354 kB raw, below the 500 kB threshold).
All chunks are well under the warning threshold when gzip-compressed
(max 309 kB gzip for `main`).

## Already Lazy-loaded

| Module | Mechanism | Trigger |
|---|---|---|
| `markdown` (marked + DOMPurify) | `React.lazy(() => import("./PreviewPane"))` | User opens preview pane or triggers HTML/PDF export |
| `useDocumentExport` | Dynamic `import("../../features/editor/markdown")` inside the export callback | User clicks Export HTML / PDF |

## Potential Lazy-loading Candidates (NOT implemented)

These are recorded as future candidates. No implementation is done
in queue 5 — the baseline is the deliverable.

| Candidate | Rationale | Size estimate |
|---|---|---|
| Hazakura Local Assist hook bundle | Only needed when the user invokes Hazakura Local Assist | ~22 kB (already separate entry) |
| Agent Workbench hook bundle | Only needed when Agent Workbench is active | ~354 kB (already separate entry) |
| Diff / Compare view | Only needed when the user opens the compare pane | Unknown |
| Search / replace panel | Only needed when the user opens find | Unknown |
| Command palette action list | The full command list is always loaded; some commands are rarely used | Small |

## Runtime Performance Notes

No runtime measurements were taken in this slice. Queue 5 is
bundle-size only. Runtime perf (open, edit, L Mode toggle, search,
long-document scroll timing) requires fixed fixtures and a
measurement harness — candidates for a follow-up slice.

## Changelog

- **2026-06-09**: Initial baseline recorded (queue 5 slice). Bundle after queue 1–4 changes.
