import { describe, expect, it } from "vitest";
import {
  buildBlockedImageElement,
  classifyMarkdownImageSource,
  formatBlockedImageNote,
  isAllowedEmbeddedImageSource,
} from "./imagePolicy";

describe("classifyMarkdownImageSource", () => {
  it("allows workspace-relative images", () => {
    expect(
      classifyMarkdownImageSource("docs/shot.png", "/ws", "/ws/README.md"),
    ).toEqual({
      kind: "allowed-workspace",
      path: "/ws/docs/shot.png",
    });
  });

  it("allows nested document-relative images inside the workspace", () => {
    expect(
      classifyMarkdownImageSource(
        "../docs/figure%201.png",
        "/ws",
        "/ws/notes/today.md",
      ),
    ).toEqual({
      kind: "allowed-workspace",
      path: "/ws/docs/figure 1.png",
    });
  });

  it("classifies relative escapes as outside-workspace without loading", () => {
    const result = classifyMarkdownImageSource(
      "../assets/cover.jpg",
      "/project/book",
      "/project/book/chapter.md",
    );
    expect(result).toEqual({
      kind: "blocked",
      reason: "outside-workspace",
      reference: "../assets/cover.jpg",
    });
  });

  it("classifies absolute paths outside the workspace distinctly", () => {
    const result = classifyMarkdownImageSource(
      "/etc/passwd",
      "/ws/book",
      "/ws/book/chapter.md",
    );
    expect(result).toEqual({
      kind: "blocked",
      reason: "absolute-outside",
      reference: "/etc/passwd",
    });
  });

  it("classifies remote URLs without treating them as local paths", () => {
    const result = classifyMarkdownImageSource(
      "https://example.com/a/b/shot.png",
      "/ws",
      "/ws/README.md",
    );
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") {
      expect(result.reason).toBe("remote");
      expect(result.reference).toContain("example.com");
      expect(result.reference).toContain("shot.png");
    }
  });

  it("classifies unsupported schemes", () => {
    const result = classifyMarkdownImageSource(
      "javascript:alert(1)",
      "/ws",
      "/ws/README.md",
    );
    expect(result).toEqual({
      kind: "blocked",
      reason: "unsupported-scheme",
      reference: "javascript",
    });
  });

  it("classifies disallowed data URIs as unsafe-data", () => {
    expect(
      classifyMarkdownImageSource(
        "data:image/svg+xml;base64,PHN2Zz4=",
        "/ws",
        "/ws/README.md",
      ),
    ).toEqual({ kind: "blocked", reason: "unsafe-data" });
  });

  it("classifies missing workspace context for relative paths", () => {
    const result = classifyMarkdownImageSource("assets/a.png", null, null);
    expect(result.kind).toBe("blocked");
    if (result.kind === "blocked") {
      expect(result.reason).toBe("missing-context");
    }
  });
});

describe("formatBlockedImageNote", () => {
  it("pins outside-workspace reason and parent-workspace next action", () => {
    const note = formatBlockedImageNote({
      reason: "outside-workspace",
      alt: "cover",
      reference: "../assets/cover.jpg",
    });
    expect(note.title).toBe("画像を表示できません: cover");
    expect(note.reasonLine).toContain("ワークスペース外の相対パス");
    expect(note.reasonLine).toContain("../assets/cover.jpg");
    expect(note.nextLine).toContain("親フォルダをワークスペースとして開く");
    expect(note.nextLine).toContain("assets/");
  });

  it("pins remote reason without implying automatic fetch", () => {
    const note = formatBlockedImageNote({
      reason: "remote",
      alt: "remote",
      reference: "example.com/shot.png",
    });
    expect(note.reasonLine).toContain("リモート画像は既定で読み込みません");
    expect(note.nextLine).toContain("ローカルに保存");
    expect(note.nextLine).toMatch(/今後/);
  });

  it("pins load-failed next actions for missing workspace files", () => {
    const note = formatBlockedImageNote({
      reason: "load-failed",
      alt: "missing",
      reference: "missing.png",
    });
    expect(note.reasonLine).toContain("読めませんでした");
    expect(note.nextLine).toContain("有無");
  });
});

describe("buildBlockedImageElement", () => {
  it("exposes stable data keys for reason and does not embed remote URLs as img", () => {
    const el = buildBlockedImageElement({
      reason: "remote",
      alt: "shot",
      reference: "example.com/shot.png",
    });
    expect(el.getAttribute("data-hazakura-image-block")).toBe("remote");
    expect(el.getAttribute("data-hazakura-image-alt")).toBe("shot");
    expect(el.getAttribute("data-hazakura-image-ref")).toBe(
      "example.com/shot.png",
    );
    expect(el.querySelector(".blocked-image-title")?.textContent).toContain(
      "shot",
    );
    expect(el.querySelector(".blocked-image-reason")?.textContent).toContain(
      "リモート",
    );
    expect(el.querySelector("img")).toBeNull();
  });
});

describe("isAllowedEmbeddedImageSource", () => {
  it("still allows small png data URLs", () => {
    expect(
      isAllowedEmbeddedImageSource("data:image/png;base64,iVBORw0KGgo="),
    ).toBe(true);
  });
});
