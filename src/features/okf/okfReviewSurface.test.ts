import { describe, expect, it } from "vitest";
import type { OkfReviewResult } from "./types";
import {
  classifyOkfFolderKind,
  presentOkfReviewSurface,
} from "./okfReviewSurface";

function baseResult(
  overrides: Partial<OkfReviewResult> = {},
): OkfReviewResult {
  return {
    summary: {
      specLabel: "OKF v0.1 Draft",
      specVersion: "0.1",
      specCommit: "ee67a5c",
      bundleRootLabel: "/ws",
      conceptCount: 0,
      indexCount: 0,
      logCount: 0,
      unreadableCount: 0,
      failureCount: 0,
      adviceCount: 0,
      hasRootIndex: false,
      declaredOkfVersion: null,
    },
    files: [],
    findings: [],
    findingsTruncated: false,
    scannedEntries: 0,
    scannedMarkdownFiles: 0,
    totalBytesRead: 0,
    truncated: false,
    cancelled: false,
    source: "disk",
    ...overrides,
  };
}

describe("classifyOkfFolderKind", () => {
  it("treats empty trees as empty", () => {
    expect(classifyOkfFolderKind(baseResult())).toBe("empty");
  });

  it("treats untyped markdown as ordinary manuscript folders", () => {
    const result = baseResult({
      summary: {
        ...baseResult().summary,
        conceptCount: 2,
        failureCount: 2,
      },
      files: [
        {
          relativePath: "a.md",
          kind: "concept",
          conceptId: "a",
          type: null,
          title: null,
          okfVersion: null,
          byteLength: 10,
        },
        {
          relativePath: "b.md",
          kind: "concept",
          conceptId: "b",
          type: null,
          title: null,
          okfVersion: null,
          byteLength: 10,
        },
      ],
      findings: [
        {
          code: "missing-frontmatter",
          severity: "failure",
          relativePath: "a.md",
          message: "missing",
        },
      ],
    });
    expect(classifyOkfFolderKind(result)).toBe("plain-markdown");
  });

  it("treats typed concepts or root index as okf-like", () => {
    expect(
      classifyOkfFolderKind(
        baseResult({
          summary: {
            ...baseResult().summary,
            hasRootIndex: true,
            indexCount: 1,
          },
          files: [
            {
              relativePath: "index.md",
              kind: "index",
              conceptId: null,
              type: null,
              title: null,
              okfVersion: "0.1",
              byteLength: 20,
            },
          ],
        }),
      ),
    ).toBe("okf-like");

    expect(
      classifyOkfFolderKind(
        baseResult({
          summary: {
            ...baseResult().summary,
            conceptCount: 1,
          },
          files: [
            {
              relativePath: "note.md",
              kind: "concept",
              conceptId: "note",
              type: "Note",
              title: "Note",
              okfVersion: null,
              byteLength: 30,
            },
          ],
        }),
      ),
    ).toBe("okf-like");
  });
});

describe("presentOkfReviewSurface", () => {
  it("splits priority failures from optional findings", () => {
    const result = baseResult({
      summary: {
        ...baseResult().summary,
        conceptCount: 1,
        failureCount: 2,
        adviceCount: 1,
        hasRootIndex: true,
      },
      files: [
        {
          relativePath: "index.md",
          kind: "index",
          conceptId: null,
          type: null,
          title: null,
          okfVersion: "0.1",
          byteLength: 10,
        },
        {
          relativePath: "a.md",
          kind: "concept",
          conceptId: "a",
          type: "Note",
          title: "A",
          okfVersion: null,
          byteLength: 10,
        },
      ],
      findings: [
        {
          code: "missing-type",
          severity: "failure",
          relativePath: "a.md",
          message: "missing type",
        },
        {
          code: "broken-link",
          severity: "failure",
          relativePath: "a.md",
          message: "broken",
          relatedPath: "x.md",
        },
        {
          code: "external-link",
          severity: "info",
          relativePath: "a.md",
          message: "external",
        },
      ],
    });

    const presentation = presentOkfReviewSurface(result);
    expect(presentation.folderKind).toBe("okf-like");
    expect(presentation.priorityFindings).toHaveLength(2);
    expect(presentation.optionalFindings).toHaveLength(1);
    expect(presentation.hasNoIssues).toBe(false);
  });
});
