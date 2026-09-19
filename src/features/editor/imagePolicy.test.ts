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
      resolvedPath: "/project/assets/cover.jpg",
      canApproveLocal: true,
    });
  });

  it("allows outside paths under approved roots when policy is not off", () => {
    const result = classifyMarkdownImageSource(
      "../assets/cover.jpg",
      "/project/book",
      "/project/book/chapter.md",
      {
        outsideImages: "ask",
        approvedRoots: ["/project/assets"],
      },
    );
    expect(result).toEqual({
      kind: "allowed-approved-local",
      path: "/project/assets/cover.jpg",
    });
  });

  it("allows outside local images only after the explicit allow setting", () => {
    expect(
      classifyMarkdownImageSource(
        "/Users/writer/Pictures/cover.jpg",
        "/project/book",
        "/project/book/chapter.md",
        { outsideImages: "allow" },
      ),
    ).toEqual({
      kind: "allowed-approved-local",
      path: "/Users/writer/Pictures/cover.jpg",
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
      resolvedPath: "/etc/passwd",
      canApproveLocal: true,
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
    expect(note.reasonLine).toContain("リモート画像は設定で許可するまで読み込みません");
    expect(note.nextLine).toContain("ローカルに保存");
    expect(note.nextLine).toMatch(/設定/);
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
  it("declares the app copy language and keeps document fragments unknown", () => {
    const el = buildBlockedImageElement({
      reason: "outside-workspace",
      alt: "cover",
      reference: "../assets/cover.jpg",
      resolvedPath: "/ws/assets/cover.jpg",
      canApproveLocal: true,
    });

    // 案内はアプリの日本語文言なので、本文（lang=""）の言語を継承させない。
    expect(el.getAttribute("lang")).toBe("ja");

    // 利用者が書いた alt と参照パスは、案内の言語へ巻き込まない。
    const fromDocument = Array.from(
      el.querySelectorAll(".blocked-image-document-text"),
    );
    expect(fromDocument.map((node) => node.textContent)).toEqual([
      "cover",
      "../assets/cover.jpg",
    ]);
    expect(
      fromDocument.every((node) => node.getAttribute("lang") === ""),
    ).toBe(true);

    // 読み上げ以外の見え方は変えない（textContent は分割前と同じ）。
    expect(el.querySelector(".blocked-image-title")?.textContent).toBe(
      "画像を表示できません: cover",
    );
    expect(el.querySelector(".blocked-image-reason")?.textContent).toContain(
      "（../assets/cover.jpg）。",
    );
    expect(el.querySelector(".blocked-image-next")?.textContent).toContain(
      "次の操作:",
    );
    expect(el.querySelector(".blocked-image-action")?.getAttribute("lang")).toBeNull();
  });

  it("does not split copy that has no document-derived fragment", () => {
    // 参照を持たない理由（data URL の形式・サイズ）は、そのまま本文の外の文言。
    const el = buildBlockedImageElement({ reason: "unsafe-data" });

    expect(el.getAttribute("lang")).toBe("ja");
    expect(el.querySelector(".blocked-image-document-text")).toBeNull();
    expect(el.querySelector(".blocked-image-reason")?.textContent).toContain(
      "埋め込み画像の形式またはサイズが非対応です",
    );
  });

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
