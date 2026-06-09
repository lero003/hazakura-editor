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
// `docs/apple-local-assist-distribution-plan.md` and is
// tested by existing Rust / Vite tests where applicable.
//
// Routing lives in `AppOverlays.tsx` under
// `preferencesDialogMode === "privacy"`. The pane is read-
// only: there are no toggles, inputs, or state writes, so
// the focus trap and close affordance are the only
// interactions the user has with it.
import { useState } from "react";
import type { PreferencesCopy } from "../../lib/locale";

type PrivacyPreferencesPaneProps = {
  copy: PreferencesCopy;
};

type Section = {
  body: string;
  heading: string;
  testId: string;
};

export function PrivacyPreferencesPane({ copy }: PrivacyPreferencesPaneProps) {
  const sections: Section[] = [
    {
      body: copy.privacyDocumentsBody,
      heading: copy.privacyDocumentsHeading,
      testId: "privacy-section-documents",
    },
    {
      body: copy.privacyBackupBody,
      heading: copy.privacyBackupHeading,
      testId: "privacy-section-backup",
    },
    {
      body: copy.privacyPreviewBody,
      heading: copy.privacyPreviewHeading,
      testId: "privacy-section-preview",
    },
    {
      body: copy.privacyAppleAssistBody,
      heading: copy.privacyAppleAssistHeading,
      testId: "privacy-section-apple-assist",
    },
    {
      body: copy.privacyAppStoreLaneBody,
      heading: copy.privacyAppStoreLaneHeading,
      testId: "privacy-section-app-store",
    },
    {
      body: copy.privacyNetworkBody,
      heading: copy.privacyNetworkHeading,
      testId: "privacy-section-network",
    },
  ];
  const [activeSectionId, setActiveSectionId] = useState(sections[0].testId);
  const activeSection =
    sections.find((section) => section.testId === activeSectionId) ??
    sections[0];

  return (
    <div className="privacy-preferences">
      <div className="privacy-preferences-summary">
        <p
          className="privacy-preferences-intro"
          data-testid="privacy-intro"
        >
          {copy.privacyIntro}
        </p>
        <p className="privacy-policy-note" data-testid="privacy-policy-note">
          {copy.privacyPolicyNote}
        </p>
      </div>
      <div
        aria-label={copy.privacySectionTabsLabel}
        className="privacy-tab-list"
        role="tablist"
      >
        {sections.map((section) => (
          <button
            aria-controls={`${section.testId}-panel`}
            aria-selected={section.testId === activeSection.testId}
            className="privacy-tab"
            id={`${section.testId}-tab`}
            key={section.testId}
            onClick={() => setActiveSectionId(section.testId)}
            role="tab"
            type="button"
          >
            {section.heading}
          </button>
        ))}
      </div>
      <div className="privacy-tab-panel-scroll">
        <section
          aria-labelledby={`${activeSection.testId}-tab`}
          className="preference-section privacy-tab-panel"
          data-testid={activeSection.testId}
          id={`${activeSection.testId}-panel`}
          role="tabpanel"
        >
          <h3>{activeSection.heading}</h3>
          <p className="preference-section-body">{activeSection.body}</p>
        </section>
      </div>
    </div>
  );
}
