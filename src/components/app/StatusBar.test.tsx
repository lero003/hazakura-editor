import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { StatusBar } from "./StatusBar";
import type { EditorTab } from "../../types";

afterEach(cleanup);

const activeTab: EditorTab = {
  contents: "# Note\n",
  encoding: "utf-8",
  error: null,
  externalFingerprint: null,
  fingerprint: "fp",
  ignoredExternalFingerprint: null,
  id: "/workspace/note.md",
  large_file_warning: false,
  lastSavedContents: "# Note\n",
  lastSavedEncoding: "utf-8",
  lastSavedLineEnding: "lf",
  line_ending: "lf",
  modified_ms: null,
  name: "note.md",
  path: "/workspace/note.md",
  saveStatus: "idle",
  size: 10,
};

describe("StatusBar", () => {
  it("keeps format controls in the trailing cluster", () => {
    const { container } = render(
      <StatusBar
        activeTab={activeTab}
        agentLabel={null}
        detail="Markdown / UTF-8 / 10 bytes"
        encodingAriaLabel="Encoding"
        encodingLabel="Encoding"
        lineEndingAriaLabel="Line endings"
        lineEndingLabel="Line endings"
        lModeEnabled={false}
        onConvertEncoding={vi.fn()}
        onConvertLineEnding={vi.fn()}
        saveAffirmation={false}
        saveAffirmationKey={null}
        statusText="Ready"
      />,
    );

    const statusBar = container.querySelector(".status-bar");
    const formatGroup = container.querySelector(".status-bar-format-group");
    const detail = container.querySelector(".status-bar-detail");

    expect(statusBar?.lastElementChild).toBe(formatGroup);
    expect(formatGroup?.previousElementSibling).toBe(detail);
    expect(formatGroup?.querySelectorAll("select")).toHaveLength(2);
    expect(detail?.getAttribute("title")).toBe("Markdown / UTF-8 / 10 bytes");
  });

  it("removes focusable format controls in L Mode", () => {
    const { container } = render(
      <StatusBar
        activeTab={activeTab}
        agentLabel={null}
        detail="Markdown / UTF-8 / 10 bytes"
        encodingAriaLabel="Encoding"
        encodingLabel="Encoding"
        lineEndingAriaLabel="Line endings"
        lineEndingLabel="Line endings"
        lModeEnabled={true}
        onConvertEncoding={vi.fn()}
        onConvertLineEnding={vi.fn()}
        saveAffirmation={false}
        saveAffirmationKey={null}
        statusText="Ready"
      />,
    );

    expect(container.querySelector(".status-bar-format-group")).toBeNull();
    expect(container.querySelectorAll("select")).toHaveLength(0);
  });
});
