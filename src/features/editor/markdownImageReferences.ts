import {
  directoryPathFromPath,
  isPathInsideDirectory,
  normalizeAbsolutePath,
} from "../../lib/utils";

type MarkdownPathForImportedImageInput = {
  activeTabPath: string | null;
  assetRelativePath: string;
  assetRootPath: string;
};

export function markdownPathForImportedImage({
  activeTabPath,
  assetRelativePath,
  assetRootPath,
}: MarkdownPathForImportedImageInput): string {
  if (!activeTabPath) {
    return assetRelativePath;
  }

  const normalizedRoot = normalizeAbsolutePath(assetRootPath);
  const normalizedDocument = normalizeAbsolutePath(activeTabPath);

  if (!isPathInsideDirectory(normalizedDocument, normalizedRoot)) {
    return assetRelativePath;
  }

  const assetPath = normalizeAbsolutePath(
    `${normalizedRoot}/${assetRelativePath}`,
  );
  const documentDirectory = directoryPathFromPath(normalizedDocument);

  if (!isPathInsideDirectory(assetPath, normalizedRoot)) {
    return assetRelativePath;
  }

  return relativePathBetweenDirectories(documentDirectory, assetPath);
}

function relativePathBetweenDirectories(fromDirectory: string, toPath: string): string {
  const fromSegments = pathSegments(fromDirectory);
  const toSegments = pathSegments(toPath);
  let commonLength = 0;

  while (
    commonLength < fromSegments.length &&
    commonLength < toSegments.length &&
    fromSegments[commonLength] === toSegments[commonLength]
  ) {
    commonLength += 1;
  }

  const upSegments = Array.from(
    { length: fromSegments.length - commonLength },
    () => "..",
  );
  const downSegments = toSegments.slice(commonLength);

  return [...upSegments, ...downSegments].join("/") || ".";
}

function pathSegments(path: string): string[] {
  return normalizeAbsolutePath(path)
    .split("/")
    .filter((segment) => segment.length > 0);
}
