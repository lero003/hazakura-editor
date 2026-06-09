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
import aboutMd from "./en/about.md?raw";
import localDataDisclosureMd from "./en/local-data-disclosure.md?raw";
import supportDiagnosticsMd from "./en/support-diagnostics.md?raw";
import openSourceAcknowledgementsMd from "./en/open-source-acknowledgements.md?raw";
import privacyPolicyMd from "./en/privacy-policy.md?raw";
import type { HelpDocumentDialogMode } from "../../../types";

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
    "This is the in-app technical disclosure. The Privacy Policy is a separate public-copy draft for website and App Store metadata review.",
  footerNote:
    "This document is an in-app reference reflecting the v0.16 app code. Use the Privacy Policy Help page for public-copy review, and confirm the final URL / metadata before submission.",
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

export const privacyPolicy: HelpDoc = {
  id: "privacy-policy",
  title: "Privacy Policy",
  kicker: "Help",
  boundaryNoteTitle: "Public policy draft",
  boundaryNoteBody:
    "This is the App Store / public-copy draft for the app's privacy policy. It is separate from the more technical Local Data Disclosure.",
  footerNote:
    "This draft reflects the current App Store preview lane. Review the final website URL and App Store metadata before submission.",
  source: privacyPolicyMd,
  sections: [
    { testId: "help-doc-section-overview", title: "Overview" },
    { testId: "help-doc-section-files", title: "Files you choose" },
    { testId: "help-doc-section-local-data", title: "Local data" },
    { testId: "help-doc-section-assist", title: "Apple Local Assist" },
    { testId: "help-doc-section-network", title: "Network and analytics" },
    { testId: "help-doc-section-contact", title: "Contact" },
  ],
};

export const openSourceAcknowledgements: HelpDoc = {
  id: "open-source-acknowledgements",
  title: "Open Source Acknowledgements",
  kicker: "Help",
  boundaryNoteTitle: "Acknowledgements draft",
  boundaryNoteBody:
    "This page lists the primary open source libraries used by the app. It is a submission-prep acknowledgement, not a replacement for a final legal license packet.",
  footerNote:
    "Before public submission, regenerate or review the complete dependency license packet from package-lock.json and src-tauri/Cargo.lock.",
  source: openSourceAcknowledgementsMd,
  sections: [
    { testId: "help-doc-section-javascript", title: "JavaScript and UI" },
    { testId: "help-doc-section-native", title: "Native app stack" },
    { testId: "help-doc-section-license-scope", title: "License scope" },
  ],
};

export const aboutHazakuraEditor: HelpDoc = {
  id: "about",
  title: "About hazakura editor",
  kicker: "Help",
  boundaryNoteTitle: "App identity",
  boundaryNoteBody:
    "About keeps product identity, support direction, and distribution-lane wording in one small Help document.",
  footerNote:
    "The current version is 0.17.0. Release, signing, and App Store status must be checked against the current build before publication claims are made.",
  source: aboutMd,
  sections: [
    { testId: "help-doc-section-app", title: "App" },
    { testId: "help-doc-section-lanes", title: "Distribution lanes" },
    { testId: "help-doc-section-support", title: "Support" },
    { testId: "help-doc-section-legal", title: "Legal notes" },
  ],
};

export const supportDiagnostics: HelpDoc = {
  id: "support-diagnostics",
  title: "Support Diagnostics",
  kicker: "Help",
  boundaryNoteTitle: "Privacy-preserving support snapshot",
  boundaryNoteBody:
    "This Help page explains what the diagnostics pane includes and what it leaves out. The interactive diagnostics pane (with the JSON snapshot, Copy, and Refresh buttons) is rendered separately by `DiagnosticsPane` so the read-only Help shell stays a read-only Help shell.",
  footerNote:
    "The diagnostics helper does not collect document contents, file paths, transcripts, or secret-looking values. A structural check rejects any forbidden key before the JSON is shown or copied.",
  source: supportDiagnosticsMd,
  sections: [
    { testId: "help-doc-section-what-is", title: "What this is" },
    { testId: "help-doc-section-includes", title: "What it includes" },
    { testId: "help-doc-section-excludes", title: "What it does not include" },
    { testId: "help-doc-section-how-to-use", title: "How to use it" },
    { testId: "help-doc-section-not-wired", title: "What is not yet wired" },
  ],
};

export const helpDocsByMode: Record<HelpDocumentDialogMode, HelpDoc> = {
  privacy: localDataDisclosure,
  diagnostics: supportDiagnostics,
  "privacy-policy": privacyPolicy,
  "open-source-acknowledgements": openSourceAcknowledgements,
  about: aboutHazakuraEditor,
};

export function isHelpDocumentDialogMode(
  mode: string,
): mode is HelpDocumentDialogMode {
  return Object.prototype.hasOwnProperty.call(helpDocsByMode, mode);
}

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
