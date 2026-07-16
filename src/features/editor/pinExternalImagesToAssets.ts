/**
 * Theme G M4 — explicit pin of external image references into workspace assets.
 * Source rewrite is always caller-applied (Undo/dirty via CodeMirror/tab update).
 */

import {
  listPinableImageReferences,
  relativeAssetPath,
  rewriteImageSources,
} from "./pinExternalImages";
import { classifyMarkdownImageSource } from "./imagePolicy";
import type { MediaImageAccessOptions } from "./imagePolicy";

export type PinExternalImagesDeps = {
  documentPath: string | null;
  workspaceRoot: string;
  mediaAccess?: MediaImageAccessOptions | null;
  importLocalImage: (absoluteSourcePath: string) => Promise<string>;
  importRemoteImageDataUrl: (url: string) => Promise<string>;
  saveDataUrlToAssets: (dataUrl: string, preferredName: string) => Promise<string>;
};

export type PinExternalImagesResult = {
  nextSource: string;
  pinnedCount: number;
  skippedCount: number;
  warnings: string[];
};

/**
 * Resolve pinable refs, copy into workspace assets, rewrite Markdown.
 * Remote pins require `importRemoteImageDataUrl` + `saveDataUrlToAssets`.
 * Does not auto-save.
 */
export async function pinExternalImagesToAssets(
  source: string,
  deps: PinExternalImagesDeps,
): Promise<PinExternalImagesResult> {
  const refs = listPinableImageReferences(source);
  const replacements = new Map<string, string>();
  const warnings: string[] = [];
  let pinnedCount = 0;
  let skippedCount = 0;

  for (const ref of refs) {
    if (replacements.has(ref.src)) {
      continue;
    }

    // Already workspace-relative assets/… stays unless it is outside via ..
    const classification = classifyMarkdownImageSource(
      ref.src,
      deps.workspaceRoot,
      deps.documentPath,
      deps.mediaAccess ?? null,
    );

    if (classification.kind === "allowed-workspace") {
      // Prefer leaving in-workspace paths alone unless they are not under assets
      // and the user asked to pin — still skip stable workspace paths.
      if (!ref.src.includes("..") && !ref.src.startsWith("/")) {
        skippedCount += 1;
        continue;
      }
    }

    try {
      if (classification.kind === "allowed-remote" || ref.kind === "remote") {
        if (!deps.mediaAccess?.loadRemoteImages && ref.kind === "remote") {
          // Allow pin even when Preview remote is Off: pin is explicit consent.
        }
        const dataUrl = await deps.importRemoteImageDataUrl(ref.src);
        const name = ref.src.split("/").pop()?.split("?")[0] || "remote.png";
        const relative = await deps.saveDataUrlToAssets(dataUrl, name);
        replacements.set(ref.src, relativeAssetPath(relative));
        pinnedCount += 1;
        continue;
      }

      if (
        classification.kind === "allowed-approved-local" ||
        classification.kind === "blocked"
      ) {
        const absolute =
          classification.kind === "allowed-approved-local"
            ? classification.path
            : classification.kind === "blocked"
              ? classification.resolvedPath
              : undefined;
        if (!absolute) {
          skippedCount += 1;
          warnings.push(`Could not resolve: ${ref.src}`);
          continue;
        }
        const relative = await deps.importLocalImage(absolute);
        replacements.set(ref.src, relativeAssetPath(relative));
        pinnedCount += 1;
        continue;
      }

      if (classification.kind === "allowed-workspace") {
        const relative = await deps.importLocalImage(classification.path);
        replacements.set(ref.src, relativeAssetPath(relative));
        pinnedCount += 1;
        continue;
      }

      skippedCount += 1;
    } catch (error) {
      skippedCount += 1;
      warnings.push(
        `Failed to pin ${ref.src}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  return {
    nextSource: rewriteImageSources(source, replacements),
    pinnedCount,
    skippedCount,
    warnings,
  };
}
