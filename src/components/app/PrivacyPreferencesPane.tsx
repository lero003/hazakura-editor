// Local Data Disclosure pane.
//
// v0.16 app-store-quality: privacy-local-data slice. This
// pane is the in-app surface that explains, in evidence-
// bounded copy, what the app's code does and does not do
// with local documents, auto-backup snapshots, Markdown
// preview / export, Apple Local Assist, and the App Store
// distribution lane. It deliberately does not make strong
// privacy claims that the implementation does not support;
// every paragraph mirrors a contract already documented in
// `docs/security-boundary.md` and
// `docs/apple-local-assist-distribution-plan.md`.
//
// Routing lives in `AppOverlays.tsx` under
// `preferencesDialogMode === "privacy"`. The pane is read-
// only: there are no toggles, inputs, or state writes, so
// the focus trap and close affordance are the only
// interactions the user has with it.
//
// Help-document viewer shell
// --------------------------
// The pane is a small Help-document viewer. The body is a
// bundled English `.md` file (`helpDocs/en/local-data-
// disclosure.md`) rendered through `renderMarkdown()`, the
// same function the editor preview uses. The Help
// surface therefore shares the preview's markdown
// sanitization and image policy (no `script` / `iframe`
// / `object` / `embed`, no external image fetch) without
// the viewer having to re-implement it. The pane does not
// own localization: the document is English-only and the
// chrome (kicker / boundary note / footer) is also
// English. This keeps Help edits and future slices
// (Privacy Policy, Open Source Licenses, About, Support
// Diagnostics) as small as dropping a new `.md` into
// `helpDocs/` and adding an entry to `helpDocs/index.ts`.
import { useMemo } from "react";
import { normalizeExternalMarkdownLink } from "../../features/editor/markdownLinks";
import { renderMarkdown } from "../../features/editor/markdown";
import { openExternalUrl } from "../../lib/tauri";
import {
  helpDocSectionId,
  injectHelpDocSectionAnchors,
  localDataDisclosure,
  type HelpDoc,
} from "./helpDocs";

type PrivacyPreferencesPaneProps = {
  // Reserved for future Help slices. The pane renders the
  // bundled `localDataDisclosure` document by default; a
  // caller can pass a different `HelpDoc` to reuse the
  // shell for Privacy Policy / Licenses / About /
  // Diagnostics without changing the dialog wiring.
  doc?: HelpDoc;
  onOpenExternalLink?: (href: string) => void | Promise<void>;
};

export function PrivacyPreferencesPane({
  doc = localDataDisclosure,
  onOpenExternalLink = openExternalUrl,
}: PrivacyPreferencesPaneProps = {}) {
  const renderedHtml = useMemo(() => {
    const base = renderMarkdown(doc.source);
    return injectHelpDocSectionAnchors(base, doc.sections);
  }, [doc]);

  return (
    <div className="privacy-preferences">
      <div className="privacy-preferences-meta">
        <p
          className="privacy-preferences-kicker"
          data-testid="help-doc-kicker"
        >
          {doc.kicker}
        </p>
        <aside
          aria-label={doc.boundaryNoteTitle}
          className="privacy-boundary-note"
          data-testid="help-doc-boundary-note"
        >
          <p className="privacy-boundary-note-title">
            {doc.boundaryNoteTitle}
          </p>
          <p className="privacy-boundary-note-body">
            {doc.boundaryNoteBody}
          </p>
        </aside>
      </div>
      <div
        aria-label={`Scrollable Help document: ${doc.title}`}
        className="privacy-tab-panel-scroll"
        onClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element)) {
            return;
          }
          const link = target.closest("a[href]");
          if (!link || !event.currentTarget.contains(link)) {
            return;
          }
          event.preventDefault();
          const externalUrl = normalizeExternalMarkdownLink(
            link.getAttribute("href") ?? "",
          );
          if (externalUrl) {
            void onOpenExternalLink(externalUrl);
          }
        }}
        role="region"
        tabIndex={0}
      >
        <article
          aria-label={doc.title}
          className="help-doc"
          data-testid="help-doc-body"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      </div>
      <footer className="privacy-preferences-footer">
        <p
          className="privacy-preferences-footer-text"
          data-testid="help-doc-footer-note"
        >
          {doc.footerNote}
        </p>
      </footer>
    </div>
  );
}

// Exported for tests that need to assert the same source
// the pane renders. Section ids are kept stable for anchor
// links and are matched 1:1 against the H2 table in
// `helpDocs/index.ts`.
export const HELP_DOC_SECTION_IDS = localDataDisclosure.sections.map(
  (section) => helpDocSectionId(section.testId),
);
