// Tests for the Local Data Disclosure pane
// (v0.16 app-store-quality: privacy-local-data slice).
//
// The pane is a read-only Help-document viewer: it reads
// a bundled English `.md` file, runs it through
// `renderMarkdown()` (which shares the editor preview
// sanitization policy), and renders the result as a
// `<article class="help-doc">` inside the existing
// Preferences dialog shell.
//
// The tests below import the real `.md` file through the
// same Vite `?raw` suffix the production bundle uses
// (via the `helpDocs` barrel). There is no `vi.mock` of
// the markdown body: any future regression in
// `helpDocs/en/local-data-disclosure.md` shows up here
// directly.
//
// The pane tests below pin:
//
// - the bundled `.md` file is rendered into a Help
//   document (H1 title, H2 sections, intro paragraph),
// - the section table in `helpDocs/index.ts` is in sync
//   with the H2 titles in the markdown source, so a
//   future copy edit that drops or renames a section
//   fails the build instead of silently producing a doc
//   with broken anchors,
// - the pane chrome (kicker, boundary card, footer) is
//   present and matches the `HelpDoc` metadata,
// - the body mirrors the evidence-bounded copy in
//   `docs/security-boundary.md` and
//   `docs/apple-local-assist-distribution-plan.md` and
//   does not drift into overclaim ("we never", "collect
//   nothing", "CSP", "blocks external links"),
// - the H2 sections anchor IDs come from the section
//   table in `helpDocs/index.ts` and stay in sync with
//   the H2 titles in the markdown source,
// - the renderer keeps the "click never navigates away
//   from the editor" routing claim without re-introducing
//   the old "blocks external links" / "CSP" overclaim.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import {
  aboutHazakuraEditor,
  helpDocsByMode,
  injectHelpDocSectionAnchors,
  localDataDisclosure,
  openSourceAcknowledgements,
  privacyPolicy,
  supportDiagnostics,
  type HelpDoc,
} from "./helpDocs";
import { PrivacyPreferencesPane } from "./PrivacyPreferencesPane";

afterEach(() => {
  cleanup();
});

function renderPane(doc?: HelpDoc) {
  return render(<PrivacyPreferencesPane doc={doc} />);
}

// The pane renders the bundled `.md` through
// `renderMarkdown()`, so each H2 lives as a flat sibling
// of the paragraphs that follow it. A `getByTestId` on
// the section id returns the H2 itself, which has no
// body text. Walk from the H2 forward until the next H2
// to recover the body of that section. This helper pins
// the "body of section X contains substring Y" checks
// below without coupling them to the exact markdown
// element structure (paragraph / list / blockquote).
function getSectionBodyText(testId: string): string {
  const body = screen.getByTestId("help-doc-body");
  const heading = body.querySelector(`#${testId}`);
  if (!(heading instanceof HTMLElement)) {
    return "";
  }
  let text = "";
  let sibling: Element | null = heading.nextElementSibling;
  while (sibling && sibling.tagName.toLowerCase() !== "h2") {
    text += sibling.textContent ?? "";
    sibling = sibling.nextElementSibling;
  }
  return text;
}

describe("helpDocs / local-data-disclosure.md", () => {
  it("loads the bundled markdown from the real .md file", () => {
    // The helpDocs barrel pulls the .md through Vite's
    // `?raw` suffix in production. If the test still
    // sees an empty string here, the build wiring is
    // broken before the pane ever renders.
    expect(localDataDisclosure.source.length).toBeGreaterThan(0);
    expect(localDataDisclosure.source).toContain("# Local Data Disclosure");
  });

  it("keeps the section table in sync with the H2 titles in the markdown source", () => {
    // Extract H2 titles from the raw markdown by line.
    // A future copy edit that adds, removes, or renames
    // an H2 in the .md must update the section table in
    // `helpDocs/index.ts` to match; otherwise the anchor
    // injection in the pane misses its target and the
    // H2 id / `data-testid` for that section disappears.
    const h2Titles = localDataDisclosure.source
      .split("\n")
      .filter((line) => line.startsWith("## "))
      .map((line) => line.replace(/^##\s+/, "").trim());
    expect(h2Titles).toEqual(
      localDataDisclosure.sections.map((section) => section.title),
    );
  });
});

describe("helpDocs bundle", () => {
  it("keeps every bundled Help document non-empty and titled", () => {
    expect(Object.values(helpDocsByMode)).toEqual([
      localDataDisclosure,
      supportDiagnostics,
      privacyPolicy,
      openSourceAcknowledgements,
      aboutHazakuraEditor,
    ]);

    for (const doc of Object.values(helpDocsByMode)) {
      expect(doc.source.length, doc.id).toBeGreaterThan(0);
      expect(doc.source).toContain(`# ${doc.title}`);
    }
  });

  it("keeps every Help document section table in sync with its markdown H2 titles", () => {
    for (const doc of Object.values(helpDocsByMode)) {
      const h2Titles = doc.source
        .split("\n")
        .filter((line) => line.startsWith("## "))
        .map((line) => line.replace(/^##\s+/, "").trim());
      expect(h2Titles, doc.id).toEqual(
        doc.sections.map((section) => section.title),
      );
    }
  });
});

describe("PrivacyPreferencesPane", () => {
  it("renders the Help-document chrome around the bundled md body", () => {
    renderPane();

    // The dialog wrapper paints the document title in its
    // own h2 (visually hidden by the privacy-mode
    // `sr-only` rule, but still announced via
    // `aria-labelledby`); the pane itself owns the Help
    // chrome (kicker, boundary card, footer) and the md
    // body.
    expect(screen.getByTestId("help-doc-kicker").textContent).toBe(
      localDataDisclosure.kicker,
    );

    const boundaryNote = screen.getByTestId("help-doc-boundary-note");
    expect(boundaryNote.textContent).toContain(
      localDataDisclosure.boundaryNoteTitle,
    );
    expect(boundaryNote.textContent).toContain(
      localDataDisclosure.boundaryNoteBody,
    );

    expect(screen.getByTestId("help-doc-footer-note").textContent).toBe(
      localDataDisclosure.footerNote,
    );

    const body = screen.getByTestId("help-doc-body");
    expect(body.querySelector("h1")?.textContent).toBe(
      localDataDisclosure.title,
    );
  });

  it("makes the Help document scroll region keyboard reachable", () => {
    renderPane(privacyPolicy);

    const scrollRegion = screen.getByRole("region", {
      name: `Scrollable Help document: ${privacyPolicy.title}`,
    });
    expect(scrollRegion.getAttribute("tabindex")).toBe("0");
    expect(scrollRegion.contains(screen.getByTestId("help-doc-body"))).toBe(
      true,
    );
  });

  it("renders the six H2 sections in the order declared in helpDocs/index.ts", () => {
    renderPane();

    const body = screen.getByTestId("help-doc-body");
    const headings = Array.from(body.querySelectorAll("h2"));
    expect(headings.map((heading) => heading.textContent)).toEqual(
      localDataDisclosure.sections.map((section) => section.title),
    );
  });

  it("can render the Privacy Policy Help document", () => {
    renderPane(privacyPolicy);

    const bodyText = screen.getByTestId("help-doc-body").textContent ?? "";
    expect(bodyText).toContain("Privacy Policy");
    expect(bodyText).toContain("support@hazakura.dev");
    expect(bodyText).toContain("https://hazakura.dev/hazakura-editor/support/");
    expect(screen.getByTestId("help-doc-boundary-note").textContent).toContain(
      privacyPolicy.boundaryNoteTitle,
    );
    expect(screen.getByTestId("help-doc-footer-note").textContent).toContain(
      "https://hazakura.dev/hazakura-editor/privacy/",
    );
  });

  it("can render the Open Source Acknowledgements Help document", () => {
    renderPane(openSourceAcknowledgements);

    const text = screen.getByTestId("help-doc-body").textContent ?? "";
    expect(text).toContain("Open Source Acknowledgements");
    expect(text).toContain("React");
    expect(text).toContain("Tauri");
    expect(text).toContain("not a complete legal license packet");
  });

  it("can render the About Help document", () => {
    renderPane(aboutHazakuraEditor);

    const text = screen.getByTestId("help-doc-body").textContent ?? "";
    expect(text).toContain("About Hazakura Editor");
    expect(text).toContain("0.18.0");
    expect(text).toContain("Safe Editor");
  });

  it("anchors each H2 with the stable testId from the section table", () => {
    renderPane();

    for (const section of localDataDisclosure.sections) {
      const anchor = screen.getByTestId("help-doc-body")?.querySelector(
        `#${section.testId}`,
      );
      expect(anchor, `missing #${section.testId}`).toBeTruthy();
      expect(anchor?.tagName.toLowerCase()).toBe("h2");
      expect(anchor?.textContent).toBe(section.title);
    }
  });

  it("describes the App Store lane omission without an overclaim", () => {
    renderPane();
    const text = getSectionBodyText("help-doc-section-app-store");
    expect(text).toContain("App Store build");
    expect(text).toContain("Agent Workbench");
    // The copy is evidence-bounded: it says the App Store
    // build "does not include" rather than the broader
    // "we never" claim, so a future copy edit that drifts
    // into an overclaim is caught here.
    expect(text).not.toContain("we never");
  });

  it("describes the network / analytics section without an overclaim", () => {
    renderPane();
    const text = getSectionBodyText("help-doc-section-network");
    // The body lists specific implementation-verified
    // surfaces (fetch, XHR, analytics, telemetry, crash
    // reporting) rather than a broad "we collect nothing"
    // claim, so a future copy edit that drifts into
    // overclaim is caught.
    expect(text).toContain("fetch");
    expect(text).toContain("analytics");
    expect(text).toContain("telemetry");
    expect(text).not.toContain("collect nothing");
  });

  it("describes the preview / export policy without the overclaim that external links are blocked", () => {
    renderPane();
    const text = getSectionBodyText("help-doc-section-preview");
    expect(text).toContain("external images");
    expect(text).toContain("script, iframe, object, and embed");
    expect(text).toContain(
      "only routes link clicks to workspace-relative text file opens",
    );
    expect(text).toContain("external scheme links");
    expect(text).toContain("absolute paths are ignored");
    expect(text).toContain("click never navigates away from the editor");
    // No overclaim drift: both old wordings must stay
    // out of the new pane.
    expect(text).not.toContain("blocks external links");
    expect(text).not.toContain("CSP blocks navigation");
  });

  it("describes local process handoffs without claiming only two launch paths", () => {
    renderPane();
    const text = getSectionBodyText("help-doc-section-network");
    expect(text).toContain("bundled Apple Local Assist helper");
    expect(text).toContain(
      "Agent Workbench can launch an allowlisted provider",
    );
    expect(text).toContain("macOS utilities");
    expect(text).toContain("Show in Finder");
    // The App Store lane description must be honest: the
    // helper is launchable in every lane, Agent Workbench
    // is Developer / GitHub-only, and explicit OS handoff
    // actions can use macOS utilities. The old v0.16
    // first-pass copy used "The only local process" and
    // then "The only local processes"; both are too
    // narrow for the implementation.
    expect(text).not.toContain("The only local process it can launch");
    expect(text).not.toContain(
      "The only local processes the app can launch",
    );
  });

  it("keeps every section body non-empty", () => {
    renderPane();
    for (const section of localDataDisclosure.sections) {
      const text = getSectionBodyText(section.testId);
      // Each section must have at least one paragraph of
      // body after its H2, otherwise the H2 reads as an
      // orphan heading.
      expect(text.trim().length, section.testId).toBeGreaterThan(0);
    }
  });
});

describe("injectHelpDocSectionAnchors", () => {
  it("rewrites H2 tags for the declared sections only", () => {
    const html = `<h1>Top</h1><h2>Files you choose</h2><p>body</p><h2>Auto-backup (.hazakura/backups/...)</h2><h2>Unknown</h2>`;
    const next = injectHelpDocSectionAnchors(html, [
      { testId: "help-doc-section-files", title: "Files you choose" },
      {
        testId: "help-doc-section-backup",
        title: "Auto-backup (.hazakura/backups/...)",
      },
    ]);
    expect(next).toContain(
      '<h2 id="help-doc-section-files" data-testid="help-doc-section-files">Files you choose</h2>',
    );
    expect(next).toContain(
      '<h2 id="help-doc-section-backup" data-testid="help-doc-section-backup">Auto-backup (.hazakura/backups/...)</h2>',
    );
    // H2 that isn't in the section table is left alone.
    expect(next).toContain("<h2>Unknown</h2>");
  });

  it("leaves the HTML alone when no sections are declared", () => {
    const html = `<h1>Top</h1><h2>Files you choose</h2>`;
    expect(injectHelpDocSectionAnchors(html, [])).toBe(html);
  });
});
