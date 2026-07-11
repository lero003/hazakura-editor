import { describe, expect, it } from "vitest";
import {
  isLModeEnabledForDocument,
  isLModeSupportedDocument,
} from "./documentSupport";

describe("isLModeSupportedDocument", () => {
  it("allows Markdown and pathless writing surfaces", () => {
    expect(isLModeSupportedDocument("note.md")).toBe(true);
    expect(isLModeSupportedDocument("/w/a.markdown")).toBe(true);
    expect(isLModeSupportedDocument("untitled.md")).toBe(true);
    expect(isLModeSupportedDocument("")).toBe(true);
    expect(isLModeSupportedDocument(null)).toBe(true);
  });

  it("rejects CSS and HTML so L Mode does not drop undo via parser remount", () => {
    expect(isLModeSupportedDocument("site.css")).toBe(false);
    expect(isLModeSupportedDocument("/w/index.html")).toBe(false);
    expect(isLModeSupportedDocument("feed.xml")).toBe(false);
  });

  it("turns off the rendered L Mode state before a non-Markdown tab mounts", () => {
    expect(isLModeEnabledForDocument(true, "note.md")).toBe(true);
    expect(isLModeEnabledForDocument(true, "site.css")).toBe(false);
    expect(isLModeEnabledForDocument(true, "index.html")).toBe(false);
    expect(isLModeEnabledForDocument(false, "note.md")).toBe(false);
  });
});
