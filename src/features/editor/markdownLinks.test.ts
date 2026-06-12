import { describe, expect, it } from "vitest";
import {
  normalizeExternalMarkdownLink,
  resolveLocalMarkdownLinkTarget,
} from "./markdownLinks";

describe("normalizeExternalMarkdownLink", () => {
  it("rejects http and https links without an explicit host separator", () => {
    expect(normalizeExternalMarkdownLink("https:hazakura.dev/no-host")).toBeNull();
    expect(normalizeExternalMarkdownLink("http:/hazakura.dev/one-slash")).toBeNull();
  });
});

describe("resolveLocalMarkdownLinkTarget", () => {
  const workspaceRoot = "/workspace";
  const sourcePath = "/workspace/docs/guide.md";

  it("resolves decoded workspace-relative links from the source document", () => {
    expect(
      resolveLocalMarkdownLinkTarget(
        "../notes/%E6%97%A5%E6%9C%AC%E8%AA%9E%20memo.md#section",
        sourcePath,
        workspaceRoot,
      ),
    ).toBe("/workspace/notes/日本語 memo.md");
  });

  it("ignores query strings before resolving the local target", () => {
    expect(
      resolveLocalMarkdownLinkTarget(
        "./reference.md?plain=1#heading",
        sourcePath,
        workspaceRoot,
      ),
    ).toBe("/workspace/docs/reference.md");
  });

  it("rejects links that are not workspace-relative file paths", () => {
    expect(
      resolveLocalMarkdownLinkTarget("https://example.com", sourcePath, workspaceRoot),
    ).toBeNull();
    expect(
      resolveLocalMarkdownLinkTarget("/workspace/docs/guide.md", sourcePath, workspaceRoot),
    ).toBeNull();
    expect(
      resolveLocalMarkdownLinkTarget("#heading", sourcePath, workspaceRoot),
    ).toBeNull();
  });

  it("rejects links that resolve outside the selected workspace", () => {
    expect(
      resolveLocalMarkdownLinkTarget("../../secret.md", sourcePath, workspaceRoot),
    ).toBeNull();
  });

  it("rejects links when the source document is outside the selected workspace", () => {
    expect(
      resolveLocalMarkdownLinkTarget(
        "guide.md",
        "/outside/docs/source.md",
        workspaceRoot,
      ),
    ).toBeNull();
  });
});
