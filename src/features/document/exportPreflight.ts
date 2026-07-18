import { parseMarkdownStructure } from "../editor/markdownStructure";
import { renderMarkdown } from "../editor/markdown";

export type ExportPreflightIssueKind =
  | "chapter-unavailable"
  | "heading-missing"
  | "image-unavailable"
  | "image-check-truncated";

export type ExportPreflightIssue = {
  kind: ExportPreflightIssueKind;
  severity: "error" | "warning";
  subject: string;
};

export type ExportPreflightResult = {
  chapterCount: number;
  checkedImageCount: number;
  issues: ExportPreflightIssue[];
};

type ExportPreflightDocument = {
  markdown: string;
  name: string;
  path: string | null;
};

export async function analyzeExportPreflight(options: {
  documents: readonly ExportPreflightDocument[];
  loadWorkspaceImage: (path: string) => Promise<unknown>;
  maxImages?: number;
  unavailableChapterPaths: readonly string[];
  workspaceRoot: string | null;
}): Promise<ExportPreflightResult> {
  const issues: ExportPreflightIssue[] = options.unavailableChapterPaths.map(
    (subject) => ({ kind: "chapter-unavailable", severity: "error", subject }),
  );
  const imagePaths = new Set<string>();

  for (const document of options.documents) {
    const hasHeading = parseMarkdownStructure(document.markdown).headings.some(
      (heading) => heading.navigationLabel !== null,
    );
    if (!hasHeading) {
      issues.push({
        kind: "heading-missing",
        severity: "warning",
        subject: document.name,
      });
    }
    const html = renderMarkdown(document.markdown, {
      documentPath: document.path,
      workspaceRoot: options.workspaceRoot,
      mediaAccess: {
        approvedRoots: [],
        loadRemoteImages: false,
        outsideImages: "ask",
      },
    });
    const template = window.document.createElement("template");
    template.innerHTML = html;
    for (const image of Array.from(
      template.content.querySelectorAll<HTMLImageElement>(
        "img[data-hazakura-image-path]",
      ),
    )) {
      const path = image.dataset.hazakuraImagePath?.trim();
      if (path) imagePaths.add(path);
    }
  }

  const maxImages = Math.max(0, options.maxImages ?? 100);
  const pathsToCheck = [...imagePaths].slice(0, maxImages);
  for (const path of pathsToCheck) {
    try {
      await options.loadWorkspaceImage(path);
    } catch {
      issues.push({
        kind: "image-unavailable",
        severity: "warning",
        subject: path,
      });
    }
  }
  if (imagePaths.size > pathsToCheck.length) {
    issues.push({
      kind: "image-check-truncated",
      severity: "warning",
      subject: String(imagePaths.size - pathsToCheck.length),
    });
  }

  return {
    chapterCount: options.documents.length,
    checkedImageCount: pathsToCheck.length,
    issues,
  };
}
