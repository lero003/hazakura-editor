/// <reference types="node" />

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const filesWithMotionTransitions = [
  "src/styles/lMode.css",
  "src/styles/agent-window.css",
  "src/styles/apple-assist-review.css",
  "src/styles/find.css",
] as const;

function readProjectFile(path: string): string {
  return readFileSync(`${process.cwd()}/${path}`, "utf8");
}

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function transitionValues(css: string): string[] {
  return [...stripCssComments(css).matchAll(/transition\s*:\s*(?<value>[^;{}]+);/g)].map(
    (match) => match.groups?.value ?? "",
  );
}

function containsBareEase(value: string): boolean {
  return /(?:^|[\s,])ease(?=\s*(?:[,;]|$))/.test(value);
}

describe("motion tokens", () => {
  it("keeps transition easing on shared motion tokens", () => {
    const bareEaseTransitions = filesWithMotionTransitions.flatMap((path) =>
      transitionValues(readProjectFile(path))
        .filter(containsBareEase)
        .map((value) => `${path}: ${value.trim()}`),
    );

    expect(bareEaseTransitions).toEqual([]);
  });

  it("keeps inline icon transitions on shared motion tokens", () => {
    const iconsSource = readProjectFile("src/components/app/Icons.tsx");

    expect(iconsSource).not.toContain("transition: 'transform 0.15s ease'");
  });
});
