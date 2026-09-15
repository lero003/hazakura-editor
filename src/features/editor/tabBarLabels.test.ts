import type { EditorTab } from "../../types";
import { describe, expect, it } from "vitest";
import { shortestDistinguishingAncestor } from "./tabBarLabels";

function tab(id: string, name: string, path: string): EditorTab {
  return {
    contents: "",
    encoding: "utf-8",
    fingerprint: id,
    id,
    lastSavedContents: "",
    lastSavedEncoding: "utf-8",
    lastSavedLineEnding: "lf",
    line_ending: "lf",
    large_file_warning: false,
    modified_ms: null,
    name,
    path,
    ignoredExternalFingerprint: null,
    externalFingerprint: null,
    saveStatus: "idle",
    error: null,
    sessionId: id,
    size: 0,
  };
}

describe("shortestDistinguishingAncestor", () => {
  it("prefers the closest differing parent folder", () => {
    const labels = shortestDistinguishingAncestor([
      tab("1", "index.md", "/book-a/chapters/index.md"),
      tab("2", "index.md", "/book-b/chapters/index.md"),
    ]);
    expect(labels.get("1")).toBe("book-a/chapters");
    expect(labels.get("2")).toBe("book-b/chapters");
  });

  it("falls back to the nearest shared folder", () => {
    const labels = shortestDistinguishingAncestor([
      tab("1", "index.md", "/book-a/2024/index.md"),
      tab("2", "index.md", "/book-a/2025/index.md"),
    ]);
    expect(labels.get("1")).toBe("2024");
    expect(labels.get("2")).toBe("2025");
  });

  it("does not label unduplicated names", () => {
    const labels = shortestDistinguishingAncestor([
      tab("1", "note.md", "/notes/note.md"),
    ]);
    expect(labels.size).toBe(0);
  });

  it("keeps widening past any fixed depth until the labels differ", () => {
    // 10 shared ancestors, then the differing folder, then 23 more shared
    // ones: uniqueness only appears at depth 24, beyond a 24-exclusive cap.
    const prefix = Array.from({ length: 10 }, (_, index) => `p${index + 1}`);
    const shared = Array.from({ length: 23 }, (_, index) => `s${index + 1}`);
    const labels = shortestDistinguishingAncestor([
      tab("1", "index.md", `/${[...prefix, "book-a", ...shared].join("/")}/index.md`),
      tab("2", "index.md", `/${[...prefix, "book-b", ...shared].join("/")}/index.md`),
    ]);
    expect(labels.get("1")).toBe(["book-a", ...shared].join("/"));
    expect(labels.get("2")).toBe(["book-b", ...shared].join("/"));
  });
});
