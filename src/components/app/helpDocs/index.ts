// Help-document bundle.
//
// v0.16 app-store-quality: privacy-local-data slice. Each
// in-app Help document is a single `.md` file that is
// loaded with Vite's `?raw` import and rendered through
// `renderMarkdown()`, the same function the editor
// preview uses. The Help surface therefore shares the
// preview's markdown sanitization (no `script` /
// `iframe` / `object` / `embed` / external image fetch)
// without the viewer having to re-implement it. Note
// that the preview's href allow-list still permits
// `http:`, `https:`, `mailto:`, `tel:`, and similar
// non-`javascript:` schemes, so Help documents should
// avoid hand-written external links; routing is not the
// viewer's job.
//
// The viewer shell in `PrivacyPreferencesPane` is generic
// over `HelpDoc`; future Help slices (Privacy Policy,
// Open Source Licenses, About, Support Diagnostics) just
// drop a new `.md` into this directory and add an entry
// here. The pane and its dialog wrapper do not need to
// change to grow the Help surface.
//
// English-only by request (the user explicitly opted out
// of a localized copy on 2026-06-09; the chrome is also
// English so the document is uniform regardless of
// `menuLanguage`).
import localDataDisclosureMd from "./en/local-data-disclosure.md?raw";

export type HelpDocSection = {
  testId: string;
  title: string;
};

export type HelpDoc = {
  id: string;
  title: string;
  kicker: string;
  boundaryNoteTitle: string;
  boundaryNoteBody: string;
  footerNote: string;
  source: string;
  sections: HelpDocSection[];
};

export const localDataDisclosure: HelpDoc = {
  id: "local-data-disclosure",
  title: "Local Data Disclosure",
  kicker: "Help",
  boundaryNoteTitle: "In-app technical disclosure",
  boundaryNoteBody:
    "This is the in-app technical disclosure. The public Privacy Policy is a separate document that still needs final copy for the website and App Store metadata.",
  footerNote:
    "This document is an in-app reference reflecting the v0.16 app code. It is not a legal-final document. Until the public Privacy Policy is finalized, this page is the most current and accurate disclosure.",
  source: localDataDisclosureMd,
  sections: [
    { testId: "help-doc-section-files", title: "Files you choose" },
    {
      testId: "help-doc-section-backup",
      title: "Auto-backup (.hazakura/backups/...)",
    },
    { testId: "help-doc-section-preview", title: "Preview and export" },
    { testId: "help-doc-section-apple-assist", title: "Apple Local Assist" },
    { testId: "help-doc-section-app-store", title: "App Store build" },
    { testId: "help-doc-section-network", title: "Network and analytics" },
  ],
};

// Slugify a section title for a stable DOM `id`. Mirrors
// the heading-slug convention used by other Markdown
// viewers (lowercase, non-alphanumerics collapsed to `-`)
// so a future "copy link to section" affordance can use
// the same slug for anchor jumps.
export function helpDocSectionId(testId: string): string {
  return testId;
}

// Post-process the rendered HTML so each H2 has a stable
// `id` that matches the section's `testId`. We deliberately
// rewrite only H2 (not H1 / H3+) because the Help
// documents in this directory use a single H1 (the
// document title) and a flat list of H2 sections.
//
// The match is a literal-title replace so the section
// table stays in sync with the markdown source; a future
// editor that drifts the H2 text away from the table will
// be caught by the pane tests instead of silently
// producing a doc with no anchor links.
export function injectHelpDocSectionAnchors(
  html: string,
  sections: HelpDocSection[],
): string {
  let next = html;
  for (const section of sections) {
    const title = section.title;
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `<h2(\\s[^>]*)?>\\s*${escaped}\\s*</h2>`,
      "i",
    );
    next = next.replace(
      pattern,
      `<h2 id="${section.testId}" data-testid="${section.testId}">${title}</h2>`,
    );
  }
  return next;
}
