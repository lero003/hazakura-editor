# OKF scaffold template assets

These Markdown files are the **bodies** of built-in knowledge-folder starters.

- Registry (ids, default folder names, path mapping):
  `src/features/okf/okfScaffoldTemplates.ts`
- Shared OKF pin / upgrade process: `docs/okf-spec-pin.md`
- Spec constants: `OKF_SPEC_*` in `src/features/okf/types.ts`

## Editing

Rewrite wording, headings, or relative paths by editing files under
`minimal/` and `book-like/`. Keep:

1. Paths listed in the registry in sync with files on disk.
2. `okf_version` and concept frontmatter consistent with the **current** pin
   in `docs/okf-spec-pin.md` (today: OKF v0.1 Draft / `ee67a5c`).
3. Templates analyzable without required failures under
   `analyzeOkfBundle` (see `okfScaffoldTemplates.test.ts`).

When upstream OKF moves, update **this tree together with** the pure review
model and fixtures—not scaffolds alone. See `docs/okf-spec-pin.md`.
