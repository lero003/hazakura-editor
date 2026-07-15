import { describe, expect, it } from "vitest";
import {
  buildOkfFixtureBundle,
  fixtureToMarkdownInputs,
  listOkfFixtureNames,
  OKF_FIXTURE_SPEC_COMMIT,
} from "./fixtures";
import {
  detectOkfFrontmatter,
  parseOkfFrontmatterMapping,
  toOkfValue,
} from "./okfFrontmatter";
import { analyzeOkfBundle } from "./okfModel";
import {
  OKF_ANALYSIS_BUDGETS,
  OKF_BUDGETS,
  OKF_SPEC_COMMIT,
  OKF_SPEC_LABEL,
  OKF_SPEC_VERSION,
} from "./types";

describe("OKF contract pin", () => {
  it("pins the reviewed Draft commit and budgets", () => {
    expect(OKF_SPEC_COMMIT).toBe("ee67a5c");
    expect(OKF_FIXTURE_SPEC_COMMIT).toBe("ee67a5c");
    expect(OKF_SPEC_VERSION).toBe("0.1");
    expect(OKF_SPEC_LABEL).toBe("OKF v0.1 Draft");
    expect(OKF_BUDGETS.MAX_OKF_WALK_ENTRIES).toBe(2_000);
    expect(OKF_BUDGETS.MAX_OKF_MARKDOWN_FILES).toBe(200);
    expect(OKF_BUDGETS.MAX_OKF_FILE_BYTES).toBe(10 * 1024 * 1024);
    expect(OKF_BUDGETS.MAX_OKF_TOTAL_BYTES).toBe(32 * 1024 * 1024);
    expect(OKF_BUDGETS.MAX_OKF_DEPTH).toBe(16);
    expect(OKF_ANALYSIS_BUDGETS.MAX_OKF_FINDINGS).toBe(1_000);
    expect(OKF_ANALYSIS_BUDGETS.MAX_OKF_LINKS_PER_FILE).toBe(500);
  });

  it("exposes the full S0 fixture catalog", () => {
    const names = listOkfFixtureNames();
    for (const required of [
      "valid-root-versioned",
      "versionless-root-index",
      "nested-index-frontmatter",
      "reserved-with-type",
      "empty-index",
      "log-order-advice",
      "invalid-yaml",
      "nested-yaml-valid",
      "cyclic-yaml-alias",
      "unclosed-yaml",
      "missing-type",
      "empty-type",
      "numeric-type",
      "list-type",
      "unknown-type-fields",
      "broken-links",
      "external-links",
      "root-relative-links",
      "extensionless-dir",
      "escape-parent",
      "missing-frontmatter",
      "missing-root-index",
      "unreadable-non-utf8",
      "unknown-okf-version",
      "japanese-essay",
    ]) {
      expect(names).toContain(required);
    }
  });
});

describe("okfFrontmatter", () => {
  it("extracts YAML between fences", () => {
    const source = "---\ntype: Note\ntitle: T\n---\n# Body\n";
    const detection = detectOkfFrontmatter(source);
    expect(detection.unclosed).toBe(false);
    expect(detection.yamlText).toBe("type: Note\ntitle: T");
    expect(source.slice(detection.bodyOffset)).toBe("# Body\n");
  });

  it("detects unclosed fences", () => {
    const detection = detectOkfFrontmatter("---\ntype: Note\n# Body\n");
    expect(detection.unclosed).toBe(true);
    expect(detection.yamlText).toBeNull();
  });

  it("parses mappings including nested YAML via the yaml package", () => {
    const ok = parseOkfFrontmatterMapping(
      "type: Note\ntags: [a, b]\ncount: 3\nflag: true\nempty:\n",
    );
    expect(ok.unparseable).toBe(false);
    expect(ok.fields.type).toBe("Note");
    expect(ok.fields.tags).toEqual(["a", "b"]);
    expect(ok.fields.count).toBe(3);
    expect(ok.fields.flag).toBe(true);
    expect(ok.fields.empty).toBeNull();

    const nested = parseOkfFrontmatterMapping("type: Note\nmeta:\n  x: 1\n");
    expect(nested.unparseable).toBe(false);
    expect(nested.fields.type).toBe("Note");
    expect(nested.fields.meta).toEqual({ x: 1 });

    const broken = parseOkfFrontmatterMapping('type: "Note\ntitle: x');
    expect(broken.unparseable).toBe(true);
  });

  it("tolerates cyclic YAML aliases without throwing or failing the mapping", () => {
    const cyclic = parseOkfFrontmatterMapping(
      "type: Note\ntitle: Cycle\nloop: &loop\n  self: *loop\n",
    );
    // yaml may accept or reject cycle depending on version/options; never throw.
    if (!cyclic.unparseable) {
      expect(cyclic.fields.type).toBe("Note");
      expect(cyclic.fields.loop).toBeDefined();
    }

    // Direct cycle conversion stays safe.
    const a: { self?: unknown } = {};
    a.self = a;
    expect(toOkfValue(a)).toEqual({ self: "[circular]" });
  });

  it("preserves repeated non-cyclic aliases and prototype-looking keys", () => {
    const parsed = parseOkfFrontmatterMapping(
      [
        "type: Note",
        "meta:",
        "  base: &base",
        "    nested: true",
        "  first: *base",
        "  second: *base",
        "__proto__:",
        "  safe: true",
      ].join("\n"),
    );

    expect(parsed.unparseable).toBe(false);
    expect(parsed.fields.meta).toEqual({
      base: { nested: true },
      first: { nested: true },
      second: { nested: true },
    });
    expect(Object.getPrototypeOf(parsed.fields)).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(parsed.fields, "__proto__")).toBe(
      true,
    );
    expect(parsed.fields.__proto__).toEqual({ safe: true });
  });
});

function analyzeFixture(name: string) {
  const bundle = buildOkfFixtureBundle(name);
  return analyzeOkfBundle(fixtureToMarkdownInputs(bundle), {
    bundleRootLabel: name,
  });
}

describe("analyzeOkfBundle matrix", () => {
  it("accepts a valid root-versioned Japanese bundle", () => {
    const result = analyzeFixture("valid-root-versioned");
    expect(result.summary.declaredOkfVersion).toBe("0.1");
    expect(result.summary.conceptCount).toBe(3);
    expect(result.summary.indexCount).toBe(2);
    expect(result.summary.logCount).toBe(1);
    expect(result.summary.failureCount).toBe(0);
    expect(result.source).toBe("disk");
    expect(result.files.map((file) => file.relativePath)).toEqual([
      "chapters/01-morning.md",
      "chapters/02-afternoon.md",
      "chapters/index.md",
      "index.md",
      "log.md",
      "notes/characters.md",
    ]);
    // External link is info, not broken advice.
    expect(
      result.findings.some(
        (item) =>
          item.code === "external-link" &&
          item.relativePath === "notes/characters.md",
      ),
    ).toBe(true);
    expect(
      result.findings.some((item) => item.code === "broken-link"),
    ).toBe(false);
  });

  it("treats missing root index as advice only", () => {
    const result = analyzeFixture("missing-root-index");
    expect(result.summary.hasRootIndex).toBe(false);
    expect(result.summary.failureCount).toBe(0);
    expect(
      result.findings.some(
        (item) =>
          item.code === "index-shape" &&
          item.message.includes("absent"),
      ),
    ).toBe(true);
  });

  it("keeps reserved files with type as index/log", () => {
    const result = analyzeFixture("reserved-with-type");
    const index = result.files.find((file) => file.relativePath === "index.md");
    const log = result.files.find((file) => file.relativePath === "log.md");
    expect(index?.kind).toBe("index");
    expect(log?.kind).toBe("log");
    expect(result.summary.conceptCount).toBe(1);
    expect(
      result.findings.filter((item) => item.code === "reserved-type-field"),
    ).toHaveLength(2);
  });

  it("advises nested index frontmatter without hard failure", () => {
    const result = analyzeFixture("nested-index-frontmatter");
    expect(result.summary.failureCount).toBe(0);
    expect(
      result.findings.some(
        (item) =>
          item.code === "nested-index-frontmatter" &&
          item.relativePath === "sub/index.md",
      ),
    ).toBe(true);
    const nested = result.files.find(
      (file) => file.relativePath === "sub/index.md",
    );
    expect(nested?.kind).toBe("index");
  });

  it("fails invalid, unclosed, missing, empty, numeric, and list types", () => {
    expect(
      analyzeFixture("invalid-yaml").findings.some(
        (item) => item.code === "unparseable-frontmatter",
      ),
    ).toBe(true);
    expect(analyzeFixture("nested-yaml-valid").summary.failureCount).toBe(0);
    expect(analyzeFixture("nested-yaml-valid").files[0]?.type).toBe("Note");
    // Cyclic alias in unknown fields must not turn a valid type into failure.
    expect(analyzeFixture("cyclic-yaml-alias").summary.failureCount).toBe(0);
    expect(analyzeFixture("cyclic-yaml-alias").files[0]?.type).toBe("Note");
    expect(
      analyzeFixture("unclosed-yaml").findings.some(
        (item) => item.code === "unparseable-frontmatter",
      ),
    ).toBe(true);
    expect(
      analyzeFixture("missing-type").findings.some(
        (item) => item.code === "missing-type",
      ),
    ).toBe(true);
    expect(
      analyzeFixture("empty-type").findings.some(
        (item) => item.code === "invalid-type",
      ),
    ).toBe(true);
    expect(
      analyzeFixture("numeric-type").findings.some(
        (item) => item.code === "invalid-type",
      ),
    ).toBe(true);
    expect(
      analyzeFixture("list-type").findings.some(
        (item) => item.code === "invalid-type",
      ),
    ).toBe(true);
    expect(
      analyzeFixture("missing-frontmatter").findings.some(
        (item) => item.code === "missing-frontmatter",
      ),
    ).toBe(true);
  });

  it("tolerates unknown types and producer fields", () => {
    const result = analyzeFixture("unknown-type-fields");
    expect(result.summary.failureCount).toBe(0);
    expect(result.files[0]?.type).toBe("AcmeWidget");
  });

  it("reports broken, external, root-relative, extensionless, and escape links", () => {
    const broken = analyzeFixture("broken-links");
    expect(
      broken.findings.filter((item) => item.code === "broken-link").length,
    ).toBeGreaterThanOrEqual(2);

    const external = analyzeFixture("external-links");
    expect(
      external.findings.filter((item) => item.code === "external-link"),
    ).toHaveLength(3);
    expect(
      external.findings.some((item) => item.code === "broken-link"),
    ).toBe(false);

    const rootRelative = analyzeFixture("root-relative-links");
    expect(
      rootRelative.findings.some((item) => item.code === "broken-link"),
    ).toBe(false);

    const extensionless = analyzeFixture("extensionless-dir");
    expect(
      extensionless.findings.some((item) => item.code === "broken-link"),
    ).toBe(false);

    const escape = analyzeFixture("escape-parent");
    expect(
      escape.findings.filter((item) => item.code === "out-of-scope-link")
        .length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("advises empty index and out-of-order log without failures", () => {
    const emptyIndex = analyzeFixture("empty-index");
    expect(emptyIndex.summary.failureCount).toBe(0);
    expect(
      emptyIndex.findings.some((item) => item.code === "index-shape"),
    ).toBe(true);

    const logOrder = analyzeFixture("log-order-advice");
    expect(logOrder.summary.failureCount).toBe(0);
    expect(
      logOrder.findings.some((item) => item.code === "log-shape"),
    ).toBe(true);
  });

  it("surfaces unreadable files without parsing them", () => {
    const result = analyzeFixture("unreadable-non-utf8");
    const unreadable = result.files.find(
      (file) => file.relativePath === "binary-looking.md",
    );
    expect(unreadable?.kind).toBe("unreadable");
    expect(unreadable?.unreadableReason).toBe("non-utf8");
    expect(result.summary.unreadableCount).toBe(1);
    expect(result.summary.conceptCount).toBe(1);
  });

  it("best-effort consumes unknown okf_version", () => {
    const result = analyzeFixture("unknown-okf-version");
    expect(result.summary.declaredOkfVersion).toBe("9.9");
    expect(result.summary.failureCount).toBe(0);
    expect(
      result.findings.some((item) => item.code === "root-index-version"),
    ).toBe(true);
  });

  it("handles the Japanese essay fixture without failures", () => {
    const result = analyzeFixture("japanese-essay");
    expect(result.summary.failureCount).toBe(0);
    expect(result.summary.conceptCount).toBe(2);
    expect(result.summary.declaredOkfVersion).toBe("0.1");
  });

  it("preserves partial truncated/cancelled metadata", () => {
    const bundle = buildOkfFixtureBundle("valid-root-versioned");
    const result = analyzeOkfBundle(fixtureToMarkdownInputs(bundle), {
      truncated: true,
      truncationReason: "markdown-files",
      cancelled: true,
      scannedEntries: 12,
      totalBytesRead: 2048,
    });
    expect(result.truncated).toBe(true);
    expect(result.truncationReason).toBe("markdown-files");
    expect(result.cancelled).toBe(true);
    expect(result.scannedEntries).toBe(12);
    expect(result.totalBytesRead).toBe(2048);
    expect(result.findingsTruncated).toBe(false);
  });

  it("bounds link analysis and reports omitted findings", () => {
    const repeatedLinks = Array.from(
      { length: OKF_ANALYSIS_BUDGETS.MAX_OKF_LINKS_PER_FILE + 25 },
      (_, index) => `[missing-${index}](./missing-${index}.md)`,
    ).join("\n");
    const content = `---\ntype: Note\n---\n\n${repeatedLinks}\n`;
    const result = analyzeOkfBundle([
      {
        relativePath: "many-links.md",
        content,
        byteLength: new TextEncoder().encode(content).length,
      },
    ]);

    expect(result.findingsTruncated).toBe(true);
    expect(result.findings.length).toBeLessThanOrEqual(
      OKF_ANALYSIS_BUDGETS.MAX_OKF_FINDINGS,
    );
    expect(
      result.findings.filter((finding) => finding.code === "broken-link"),
    ).toHaveLength(OKF_ANALYSIS_BUDGETS.MAX_OKF_LINKS_PER_FILE);
  });

  it("never retains more findings than the global analysis budget", () => {
    const inputs = Array.from(
      { length: OKF_ANALYSIS_BUDGETS.MAX_OKF_FINDINGS + 100 },
      (_, index) => ({
        relativePath: `concepts/${String(index).padStart(4, "0")}.md`,
        content: "# Missing frontmatter",
        byteLength: 21,
      }),
    );

    const result = analyzeOkfBundle(inputs);

    expect(result.findings).toHaveLength(
      OKF_ANALYSIS_BUDGETS.MAX_OKF_FINDINGS,
    );
    expect(result.findingsTruncated).toBe(true);
  });
});

describe("analyzeDiscoveryResult", () => {
  it("maps a discovery-shaped payload into the pure model", async () => {
    const { analyzeDiscoveryResult } = await import("./fromDiscovery");
    const bundle = buildOkfFixtureBundle("valid-root-versioned");
    const discovery = {
      bundleRoot: "/tmp/bundle",
      files: fixtureToMarkdownInputs(bundle).map((file) => ({
        relativePath: file.relativePath,
        content: file.content,
        byteLength: file.byteLength,
        unreadableReason: file.unreadableReason ?? null,
      })),
      scannedEntries: 20,
      scannedMarkdownFiles: bundle.files.length,
      totalBytesRead: 4096,
      truncated: false,
      truncationReason: null,
      cancelled: false,
    };

    const result = analyzeDiscoveryResult(discovery, {
      bundleRootLabel: "bundle",
    });
    expect(result.summary.failureCount).toBe(0);
    expect(result.summary.conceptCount).toBe(3);
    expect(result.scannedEntries).toBe(20);
    expect(result.totalBytesRead).toBe(4096);
    expect(result.source).toBe("disk");
  });
});
