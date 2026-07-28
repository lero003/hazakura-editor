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
