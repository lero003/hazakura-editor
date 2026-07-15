import { describe, expect, it } from "vitest";
import { analyzeOkfBundle } from "./okfModel";
import {
  getOkfScaffoldTemplate,
  listOkfScaffoldTemplateIds,
  OKF_SCAFFOLD_SPEC_COMMIT,
} from "./okfScaffoldTemplates";
import { OKF_SPEC_COMMIT } from "./types";

describe("okfScaffoldTemplates", () => {
  it("shares the single OKF Draft pin with the review model", () => {
    // Pin authority: docs/okf-spec-pin.md — bump commit only with co-updates.
    expect(OKF_SCAFFOLD_SPEC_COMMIT).toBe(OKF_SPEC_COMMIT);
    expect(OKF_SCAFFOLD_SPEC_COMMIT).toBe("ee67a5c");
  });

  it("exposes minimal and book-like starters", () => {
    expect(listOkfScaffoldTemplateIds()).toEqual(["minimal", "book-like"]);
  });

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
    },
  );
});
