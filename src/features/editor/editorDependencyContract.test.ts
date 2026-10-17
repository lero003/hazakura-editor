import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import * as ts from "typescript/unstable/ast";
import { API } from "typescript/unstable/sync";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type DependencyUse = { packageName: string; runtime: boolean; file: string };
type Manifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
) as Manifest;
const lock = JSON.parse(
  readFileSync(join(root, "package-lock.json"), "utf8"),
) as { packages: Record<string, Manifest & { version?: string }> };

function collectEditorDependencies(sourceFile: ts.SourceFile): DependencyUse[] {
  const file = relative(root, sourceFile.fileName);
  const uses: DependencyUse[] = [];
  function add(module: ts.Node, runtime: boolean) {
    if (!ts.isStringLiteralLikeNode(module)) return;
    const name = module.text;
    if (name !== "codemirror" && !/^@(codemirror|lezer)\//.test(name)) return;
    uses.push({
      packageName: name.startsWith("@") ? name.split("/").slice(0, 2).join("/") : name,
      runtime,
      file,
    });
  }
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const onlyTypeSpecifiers = bindings && ts.isNamedImports(bindings)
        && bindings.elements.length > 0
        && bindings.elements.every((element) => element.isTypeOnly);
      add(node.moduleSpecifier, !(clause?.phaseModifier === ts.SyntaxKind.TypeKeyword
        || (!clause?.name && onlyTypeSpecifiers)));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const clause = node.exportClause;
      const onlyTypeSpecifiers = clause && ts.isNamedExports(clause)
        && clause.elements.length > 0
        && clause.elements.every((element) => element.isTypeOnly);
      add(node.moduleSpecifier, !(node.isTypeOnly || onlyTypeSpecifiers));
    } else if (ts.isCallExpression(node)
      && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && node.arguments.length > 0) {
      add(node.arguments[0], true);
    } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
      add(node.argument.literal, false);
    }
    node.forEachChild(visit);
  }
  visit(sourceFile);
  return uses;
}

function productSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === "__tests__" ? [] : productSourceFiles(path);
    }
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)
      || /\.(test|spec)\.tsx?$/.test(entry.name) || entry.name === "test-setup.ts") return [];
    return [path];
  });
}

const fixtureSource = `
      // import { basicSetup } from "codemirror";
      const label = "codemirror";
      import type { Tree } from "@lezer/common";
      import { type Extension } from "@codemirror/state";
      import { EditorView, type ViewUpdate } from "@codemirror/view";
      import "@codemirror/search";
      export type { SyntaxNode } from "@lezer/common";
      export { type HighlightStyle } from "@codemirror/language";
      export { markdown, type MarkdownConfig } from "@codemirror/lang-markdown";
      export * from "@lezer/highlight";
      const commands = import("@codemirror/commands");
      const state = import(\`@codemirror/state\`);
      type State = import("@codemirror/state").EditorState;
      import React from "react";
    `;
const configPath = join(root, "tsconfig.editor-dependency-contract.json");
const fixturePath = join(root, "editor-dependency-contract-fixture.ts");
const productFiles = productSourceFiles(join(root, "src"));
let api: API | undefined;
let productUses: DependencyUse[] = [];
let fixtureUses: DependencyUse[] = [];

beforeAll(() => {
  // TypeScript 7 exposes ASTs through its native API. The virtual config and
  // fixture avoid changing the product tsconfig or writing extra files.
  const virtualFiles: Record<string, string> = {
    [configPath]: JSON.stringify({
      compilerOptions: { noResolve: true, noLib: true, jsx: "react-jsx" },
      files: [...productFiles, fixturePath],
    }),
    [fixturePath]: fixtureSource,
  };
  api = new API({
    cwd: root,
    fs: {
      readFile: (file) => virtualFiles[file],
      fileExists: (file) => file in virtualFiles ? true : undefined,
    },
  });
  const snapshot = api.updateSnapshot({ openProjects: [configPath] });
  try {
    const project = snapshot.getProject(configPath);
    if (!project) throw new Error("Editor dependency source project was not parsed");
    function readUses(file: string) {
      const source = project!.program.getSourceFile(file);
      if (!source) throw new Error(`Editor dependency source was not parsed: ${file}`);
      return collectEditorDependencies(source);
    }
    productUses = productFiles.flatMap(readUses);
    fixtureUses = readUses(fixturePath);
  } finally {
    snapshot.dispose();
  }
});

afterAll(() => api?.close());

describe("editor dependency contract", () => {
  it("distinguishes runtime use, type-only use, re-exports, and literal dynamic imports", () => {
    const uses = fixtureUses;
    expect(uses.map(({ packageName, runtime }) => [packageName, runtime])).toEqual([
      ["@lezer/common", false],
      ["@codemirror/state", false],
      ["@codemirror/view", true],
      ["@codemirror/search", true],
      ["@lezer/common", false],
      ["@codemirror/language", false],
      ["@codemirror/lang-markdown", true],
      ["@lezer/highlight", true],
      ["@codemirror/commands", true],
      ["@codemirror/state", true],
      ["@codemirror/state", false],
    ]);
  });

  it("declares every editor package used by product source directly", () => {
    expect(productUses.length).toBeGreaterThan(0);
    const missing = productUses.filter(({ packageName, runtime }) => {
      return !manifest.dependencies?.[packageName]
        && (runtime || !manifest.devDependencies?.[packageName]);
    });
    expect(missing, "Runtime imports need dependencies; type-only imports also need a direct declaration")
      .toEqual([]);
  });

  it("does not depend on the unused codemirror basicSetup bundle", () => {
    expect(manifest.dependencies?.codemirror).toBeUndefined();
    expect(manifest.devDependencies?.codemirror).toBeUndefined();
    expect(productUses.filter(({ packageName }) => packageName === "codemirror")).toEqual([]);
    expect(lock.packages["node_modules/codemirror"]).toBeUndefined();
  });

  it("keeps direct declarations and installed editor versions aligned with the lock", () => {
    expect(lock.packages[""].dependencies).toEqual(manifest.dependencies);
    expect(lock.packages[""].devDependencies).toEqual(manifest.devDependencies);
    for (const packageName of new Set(productUses.map((use) => use.packageName))) {
      const locked = lock.packages[`node_modules/${packageName}`];
      const installed = JSON.parse(
        readFileSync(join(root, "node_modules", packageName, "package.json"), "utf8"),
      ) as { version: string };
      expect(locked?.version, packageName).toBe(installed.version);
    }
  });
});
