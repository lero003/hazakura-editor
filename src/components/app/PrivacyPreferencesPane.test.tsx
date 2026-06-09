// Tests for the Privacy & Local Data disclosure pane
// (v0.16 app-store-quality: privacy-local-data slice).
//
// The pane is a read-only surface. It just renders a list
// of sections pulled out of `PreferencesCopy`. The tests
// below pin:
//
// - the pane renders the title, intro, and every section
//   for the current menu language,
// - the section order matches the implementation order in
//   `PrivacyPreferencesPane.tsx` so a future reorder is
//   caught as a deliberate test edit,
// - the pane is present in all three supported menu
//   languages (en, ja, kana) without the user-visible copy
//   collapsing or becoming English-by-default,
// - none of the section bodies are blank or English-only
//   for ja / kana (the slice is reviewed by Codex in both
//   languages).
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { getPreferencesCopy } from "../../lib/locale";
import { PrivacyPreferencesPane } from "./PrivacyPreferencesPane";

afterEach(() => {
  cleanup();
});

function renderPane(lang: "en" | "ja" | "kana") {
  return render(<PrivacyPreferencesPane copy={getPreferencesCopy(lang)} />);
}

describe("PrivacyPreferencesPane", () => {
  it("renders the intro and all six sections in English", () => {
    const copy = getPreferencesCopy("en");
    render(<PrivacyPreferencesPane copy={copy} />);

    // The pane is rendered inside the existing
    // `PreferencesDialog`, which paints the localized
    // title in its own h2. The pane itself owns the
    // intro and the per-section bodies, so we only
    // assert those.
    expect(screen.getByTestId("privacy-intro").textContent).toBe(
      copy.privacyIntro,
    );
    expect(screen.getByTestId("privacy-section-documents")).toBeTruthy();
    expect(screen.getByTestId("privacy-section-backup")).toBeTruthy();
    expect(screen.getByTestId("privacy-section-preview")).toBeTruthy();
    expect(screen.getByTestId("privacy-section-apple-assist")).toBeTruthy();
    expect(screen.getByTestId("privacy-section-app-store")).toBeTruthy();
    expect(screen.getByTestId("privacy-section-network")).toBeTruthy();
  });

  it("renders the localized copy in Japanese", () => {
    const copy = getPreferencesCopy("ja");
    render(<PrivacyPreferencesPane copy={copy} />);

    expect(screen.getByTestId("privacy-intro").textContent).toBe(
      copy.privacyIntro,
    );

    // The body paragraphs must come from the Japanese
    // `PreferencesCopy`, not the English one. Checking a
    // single distinctive substring is enough to catch a
    // silent English fallback.
    const docs = screen.getByTestId("privacy-section-documents");
    expect(docs.textContent).toContain("ファイル/フォルダピッカー");
    expect(docs.textContent).not.toContain("file or folder picker");
  });

  it("renders the localized copy in kana (hiragana-centered) style", () => {
    const copy = getPreferencesCopy("kana");
    render(<PrivacyPreferencesPane copy={copy} />);

    const docs = screen.getByTestId("privacy-section-documents");
    expect(docs.textContent).toContain("ふぁいる");
    // The kana copy is intentionally hiragana-centered; an
    // accidental katakana / English body would mean a
    // future copy edit pulled in the ja branch.
    expect(docs.textContent).not.toContain("file or folder picker");
  });

  it("exposes the App Store lane omission section so App Review can find it", () => {
    const copy = getPreferencesCopy("en");
    render(<PrivacyPreferencesPane copy={copy} />);

    const appStoreSection = screen.getByTestId("privacy-section-app-store");
    expect(appStoreSection.textContent).toContain("App Store build");
    expect(appStoreSection.textContent).toContain("Agent Workbench");
    // The copy is evidence-bounded: it says the App Store
    // build "does not include" rather than the broader "we
    // never" claim, so a future copy edit that drifts into
    // an overclaim is caught here.
    expect(appStoreSection.textContent).not.toContain("we never");
  });

  it("exposes the network / analytics section without an overclaim", () => {
    const copy = getPreferencesCopy("en");
    render(<PrivacyPreferencesPane copy={copy} />);

    const network = screen.getByTestId("privacy-section-network");
    // The body lists specific implementation-verified
    // surfaces (fetch, XHR, analytics, telemetry, crash
    // reporting) rather than a broad "we collect nothing"
    // claim, so a future copy edit that drifts into
    // overclaim is caught.
    expect(network.textContent).toContain("fetch");
    expect(network.textContent).toContain("analytics");
    expect(network.textContent).toContain("telemetry");
    expect(network.textContent).not.toContain("collect nothing");
  });

  it("describes the preview / export policy without the overclaim that external links are blocked", () => {
    // The reviewer caught a v0.16 first-pass overclaim:
    // `renderMarkdown()` actually allows `http` / `https` /
    // `mailto` / `tel` `href`s, and HTML export preserves
    // them. The primary mechanism that prevents the click
    // from navigating is `PreviewPane.handleClick` calling
    // `event.preventDefault()` and routing through
    // `resolveLocalMarkdownLinkTarget` (`markdownLinks.ts`),
    // which rejects external schemes and absolute paths.
    // The CSP is defense-in-depth, not the primary gate.
    // The pane must describe the routing, not the CSP.
    const enResult = renderPane("en");
    const enPreview = enResult.getByTestId("privacy-section-preview");
    expect(enPreview.textContent).toContain("external images");
    expect(enPreview.textContent).toContain("script, iframe, object, and embed");
    expect(enPreview.textContent).toContain(
      "only routes link clicks to workspace-relative text file opens",
    );
    expect(enPreview.textContent).toContain("external scheme links");
    expect(enPreview.textContent).toContain("absolute paths are ignored");
    expect(enPreview.textContent).toContain("click never navigates away from the editor");
    // No overclaim drift: both old wordings must stay
    // out of the new pane.
    expect(enPreview.textContent).not.toContain("blocks external links");
    expect(enPreview.textContent).not.toContain("CSP blocks navigation");
    cleanup();

    const jaResult = renderPane("ja");
    const jaPreview = jaResult.getByTestId("privacy-section-preview");
    expect(jaPreview.textContent).toContain("workspace-relative");
    expect(jaPreview.textContent).toContain("外部 scheme");
    expect(jaPreview.textContent).toContain("絶対パス");
    expect(jaPreview.textContent).toContain("エディタから離れる遷移は起こりません");
    expect(jaPreview.textContent).not.toContain("CSP のため");
    expect(jaPreview.textContent).not.toContain("外部リンクの href");
  });

  it("describes local process handoffs without claiming only two launch paths", () => {
    // The reviewer caught a v0.16 first-pass overclaim:
    // the previous copy said "The only local process it
    // can launch is an allowlisted Agent Workbench
    // provider" — but `tauri.conf.json`'s `bundle.externalBin`
    // bundles `hazakura-apple-assist-helper` in every
    // build lane (App Store + Developer), so the App
    // Store description must not exclude the helper.
    const enResult = renderPane("en");
    const enNetwork = enResult.getByTestId("privacy-section-network");
    expect(enNetwork.textContent).toContain("bundled Apple Local Assist helper");
    expect(enNetwork.textContent).toContain(
      "Agent Workbench can launch an allowlisted provider",
    );
    expect(enNetwork.textContent).toContain("macOS utilities");
    expect(enNetwork.textContent).toContain("Show in Finder");
    // The App Store lane description must be honest: the
    // helper is launchable in every lane, Agent Workbench is
    // Developer / GitHub-only, and explicit OS handoff actions
    // can use macOS utilities. The old v0.16 first-pass copy
    // used "The only local process" and then "The only local
    // processes"; both are too narrow for the implementation.
    expect(enNetwork.textContent).not.toContain("The only local process it can launch");
    expect(enNetwork.textContent).not.toContain("The only local processes the app can launch");
    cleanup();

    const jaResult = renderPane("ja");
    const jaNetwork = jaResult.getByTestId("privacy-section-network");
    expect(jaNetwork.textContent).toContain("Apple Local Assist helper");
    expect(jaNetwork.textContent).toContain("Agent Workbench");
    expect(jaNetwork.textContent).toContain("Finderで表示");
    expect(jaNetwork.textContent).toContain("macOS の機能");
    // Old singular-form overclaim in Japanese: it
    // described only Agent Workbench as the launchable
    // local process and excluded the bundled helper.
    expect(jaNetwork.textContent).not.toContain("Agent Workbench を使うときだけ");
  });

  it("keeps every section body non-empty across all three languages", () => {
    for (const lang of ["en", "ja", "kana"] as const) {
      const copy = getPreferencesCopy(lang);
      const { container } = render(<PrivacyPreferencesPane copy={copy} />);
      const bodies = container.querySelectorAll(".preference-section-body");
      expect(bodies.length).toBe(6);
      for (const body of Array.from(bodies)) {
        expect(body.textContent?.trim().length, `${lang} body`).toBeGreaterThan(0);
      }
    }
  });
});
