// Privacy & Local Data disclosure pane.
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

  return (
    <div className="preferences-sections privacy-preferences">
      <p
        className="privacy-preferences-intro"
        data-testid="privacy-intro"
      >
        {copy.privacyIntro}
      </p>
      {sections.map((section) => (
        <section
          aria-label={section.heading}
          className="preference-section"
          data-testid={section.testId}
          key={section.testId}
        >
          <h3>{section.heading}</h3>
          <p className="preference-section-body">{section.body}</p>
        </section>
      ))}
    </div>
  );
}
