import { describe, expect, it } from "vitest";
import { analyzeOkfBundle } from "./okfModel";
import {
  getOkfScaffoldTemplate,
  listOkfScaffoldTemplateIds,
  OKF_SCAFFOLD_SPEC_COMMIT,
} from "./okfScaffoldTemplates";
import { OKF_SPEC_COMMIT } from "./types";

describe("okfScaffoldTemplates", () => {
  it("shares the single OKF v0.2 pin with the review model", () => {
    // Pin authority: docs/okf-spec-pin.md — bump commit only with co-updates.
    expect(OKF_SCAFFOLD_SPEC_COMMIT).toBe(OKF_SPEC_COMMIT);
    expect(OKF_SCAFFOLD_SPEC_COMMIT).toBe(
      "3fcbb9f828c2f23d109c855ee403c3a4c81f3a96",
    );
  });

  it("exposes minimal and book-like starters", () => {
    expect(listOkfScaffoldTemplateIds()).toEqual(["minimal", "book-like"]);
  });

  it("shows the whole book shape in the book-like starter", () => {
    const template = getOkfScaffoldTemplate(
      "book-like",
      new Date(2031, 1, 3, 12, 0, 0),
    );

    expect(template.files.map((file) => file.relativePath)).toEqual([
      "index.md",
      "chapters/01-opening.md",
      "chapters/02-development.md",
      "chapters/03-turning-point.md",
      "chapters/04-ending.md",
      "notes/overview.md",
      "notes/characters.md",
      "notes/setting.md",
      "log.md",
    ]);

    const index = template.files.find(
      (file) => file.relativePath === "index.md",
    );
    const overview = template.files.find(
      (file) => file.relativePath === "notes/overview.md",
    );

    expect(index?.contents).toContain("## 章立て");
    expect(index?.contents).toContain(
      "[全体構成](notes/overview.md)",
    );
    expect(index?.contents).toContain(
      "[第四章 結末](chapters/04-ending.md)",
    );
    expect(overview?.contents).toContain("## 一文で表す");
    expect(overview?.contents).toContain("## 全体の流れ");
    expect(overview?.contents).toContain("## まだ決めていないこと");
  });

  it.each(listOkfScaffoldTemplateIds())(
    "materializes the local creation date in template %s",
    (id) => {
      const template = getOkfScaffoldTemplate(
        id,
        new Date(2031, 1, 3, 12, 0, 0),
      );
      const log = template.files.find((file) => file.relativePath === "log.md");

      expect(log?.contents).toContain("## 2031-02-03");
      expect(log?.contents).not.toContain("{{CREATED_DATE}}");
    },
  );

  it.each(listOkfScaffoldTemplateIds())(
    "template %s analyzes without required failures",
    (id) => {
      const template = getOkfScaffoldTemplate(id);
      const files = template.files.map((file) => ({
        relativePath: file.relativePath,
        content: file.contents,
        byteLength: new TextEncoder().encode(file.contents).length,
      }));
      const result = analyzeOkfBundle(files);
      const required = result.findings.filter(
        (finding) => finding.severity === "failure",
      );
      expect(required).toEqual([]);
      expect(result.summary.conceptCount).toBeGreaterThan(0);
      expect(result.summary.declaredOkfVersion).toBe("0.2");
      expect(template.files.some((file) => file.contents.includes("timestamp:"))).toBe(
        false,
      );
      expect(template.files.some((file) => file.contents.includes("generated:"))).toBe(
        false,
      );
      expect(template.files.some((file) => file.contents.includes("verified:"))).toBe(
        false,
      );
    },
  );
});
