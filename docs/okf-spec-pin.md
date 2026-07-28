# OKF Spec Pin And Evolution

Status: Operational
Scope: OKF consumer pin, co-update surfaces, and version-upgrade process
Authority: High for OKF compatibility, review, fixtures, and scaffolds
Last reviewed: 2026-07-28 (OKF v0.2 pin adopted for v2.4)

## Current Pin

Hazakura does **not** track OKF `main` live. Implementation is pinned to one
reviewed upstream snapshot.

| Field | Value |
|---|---|
| Label | OKF v0.2 |
| Version string | `0.2` |
| Upstream commit | [`3fcbb9f`](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/3fcbb9f828c2f23d109c855ee403c3a4c81f3a96/okf/SPEC.md) |
| Raw SPEC | [`SPEC.md`](https://raw.githubusercontent.com/GoogleCloudPlatform/knowledge-catalog/3fcbb9f828c2f23d109c855ee403c3a4c81f3a96/okf/SPEC.md) |
| In-code constants | `OKF_SPEC_VERSION` / `OKF_SPEC_COMMIT` / `OKF_SPEC_LABEL` in `src/features/okf/types.ts` |

UI and release copy must describe **compatibility / 互換の出発点**, not
formal certification or complete OKF support. OKF is a knowledge-bundle shape,
not a book-order or publishing format. Book Scope remains a separate Hazakura
contract (`docs/superpowers/specs/2026-07-02-v2-book-scope-design.md`).

## Why Pinning Matters

When upstream OKF changes (version, reserved files, frontmatter rules, link
rules, vocabulary), **templates and integrity checks drift together**. A new
scaffold that still emits an earlier `okf_version` under a consumer that expects
a later version, or fixtures that no longer match the pure model, is a product
defect—not a cosmetic mismatch.

## v0.2 Consumer Boundary

- New scaffolds declare `okf_version: "0.2"`.
- Existing v0.1 bundles, legacy `timestamp`, and body `# Citations` remain
  best-effort readable. Hazakura does not reject, rewrite, or migrate them.
- `sources`, sibling `usage_window`, `generated`, `verified`, `status`,
  `stale_after`, and computation/attestation-related mappings are accepted as
  optional data.
- Hazakura does not calculate trust tiers or staleness, validate those optional
  shapes, execute attesters/executors, or add a dashboard for them.

Therefore every OKF consumer surface must share one pin and update as a set.

## Co-update Surfaces (always change together)

When the pin moves, review and update **all** of the following in one lane:

| Surface | Location |
|---|---|
| Pin constants | `src/features/okf/types.ts` |
| Pure review / advice model | `src/features/okf/okfModel.ts`, frontmatter/links/reserved/review surface |
| Discovery budgets (if SPEC-driven) | `src-tauri` OKF scan + mirrored `OKF_BUDGETS` |
| Deterministic fixtures | `src/features/okf/fixtures.ts`, `scripts/generate-v1.11-okf-smoke.mjs` (or successor) |
| Scaffold templates (body + paths) | `src/features/okf/scaffoldTemplates/assets/**`, `okfScaffoldTemplates.ts` registry |
| Locale / UI strings that name the draft | `src/lib/locale/okfReview.ts`, command palette / menu labels if needed |
| Design contracts | `docs/v1.11-okf-draft-preview-design.md`, `docs/v1.12-okf-scaffold-design.md`, this file |
| Smoke / living docs | `docs/smoke-checklist.md`, `docs/current-status.md`, handoff if claims change |
| Tests that hardcode the commit | Vitest + Rust tests that assert `3fcbb9f828c2f23d109c855ee403c3a4c81f3a96` / version strings |

Do **not** vendor the full upstream SPEC into the app tree. Link the pinned
commit; keep Hazakura’s consumer rules in-repo.

## Upgrade Process (required)

1. **Stop and design-review** — never silently follow upstream `main`.
2. Diff the pinned SPEC against the candidate revision; list breaking vs
   advice-only changes.
3. Decide the new pin (commit + version label) and write it here and in
   `types.ts` first.
4. Update pure model + fixtures until unit tests and
   `npm run smoke:fixtures:v1.11-okf` (or renamed successor) match the new
   contract.
5. Update scaffold **assets** so newly created folders still open to a clean
   (or intentionally advice-only) review under the new model.
6. Re-run review → open/edit → recheck smoke; confirm ordinary Markdown folders
   are still framed as preparation, not “broken workspace”.
7. Refresh UI copy if the user-visible draft name changes.
8. Record residual risks (permissive resolutions, upstream tensions) in the
   active design doc—not only in chat.

## Non-goals Of A Pin Bump

- Claiming formal OKF certification
- Auto-repair of existing user folders on open
- Treating OKF as Book Scope / chapter order / whole-book export
- Background re-scan or persistent OKF index
- Shipping multiple simultaneous pins in the UI without an explicit product
  decision (one active pin at a time unless a future lane designs migration)

## Related Lanes

| Lane | Role | Contract |
|---|---|---|
| v1.11 | Read-only compatibility review + distribution confidence | `docs/v1.11-okf-draft-preview-design.md` |
| v1.12 | Explicit starter scaffolds (write) | `docs/v1.12-okf-scaffold-design.md` |
| v2 | Hazakura Book Scope (not OKF book format) | `docs/superpowers/specs/2026-07-02-v2-book-scope-design.md` |

v1.11 and v1.12 share this pin file. A pin bump is allowed to land as a small
dedicated slice without reopening Book Scope.
