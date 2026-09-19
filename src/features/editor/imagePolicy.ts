// Shared Markdown image policy for surfaces that render image URLs directly
// into the WebView. Workspace / approved-local / remote loads go through
// bounded loaders (Rust). Classification is pure and side-effect free.
//
// Theme G:
//   M0 — honest block reasons + next actions
//   M1 — outside-local only when approved roots + preference allow
//   M2 — https remote only when Preference is On (http always blocked)

import {
  isPathUnderApprovedRoots,
  type MediaImageSettings,
  type OutsideImagePolicy,
  DEFAULT_MEDIA_IMAGE_SETTINGS,
} from "./mediaImageSettings";
import { DOCUMENT_CONTENT_LANG } from "../app/documentLanguage";

export const MAX_EMBEDDED_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

/** Stable machine keys for blocked-image notes (tests + actions). */
export type ImageBlockReason =
  | "outside-workspace"
  | "absolute-outside"
  | "remote"
  | "unsupported-scheme"
  | "unsafe-data"
  | "invalid-src"
  | "missing-context"
  | "load-failed";

export type ImageLoadOrigin = "workspace" | "approved-local" | "remote";

export type MediaImageAccessOptions = {
  outsideImages?: OutsideImagePolicy;
  loadRemoteImages?: boolean;
  /** Absolute approved file or folder paths for outside-local loads. */
  approvedRoots?: readonly string[];
};

export type MarkdownImageClassification =
  | { kind: "allowed-data"; src: string }
  | { kind: "allowed-workspace"; path: string }
  | { kind: "allowed-approved-local"; path: string }
  | { kind: "allowed-remote"; url: string }
  | {
      kind: "blocked";
      reason: ImageBlockReason;
      /** Short display-safe hint (relative src, host URL, scheme). */
      reference?: string;
      /** Absolute resolved path when known (for approve actions). */
      resolvedPath?: string;
      /** Full remote URL when reason is remote (display still truncated). */
      remoteUrl?: string;
      /** Offer parent-folder approve control (M1). */
      canApproveLocal?: boolean;
    };

export function isAllowedEmbeddedImageSource(src: string): boolean {
  if (src.length > MAX_EMBEDDED_IMAGE_BYTES) {
    return false;
  }
  return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src);
}

export function resolveMediaAccessOptions(
  options?: MediaImageAccessOptions | null,
  settings?: Partial<MediaImageSettings> | null,
): Required<MediaImageAccessOptions> {
  const media = {
    ...DEFAULT_MEDIA_IMAGE_SETTINGS,
    ...settings,
  };
  return {
    outsideImages: options?.outsideImages ?? media.outsideImages,
    loadRemoteImages: options?.loadRemoteImages ?? media.loadRemoteImages,
    approvedRoots: options?.approvedRoots ?? [],
  };
}

/**
 * Pure classification for Preview / e-book / HTML / PDF image policy.
 * Does not read disk or network.
 */
export function classifyMarkdownImageSource(
  src: string,
  workspaceRoot: string | null,
  documentPath: string | null,
  access?: MediaImageAccessOptions | null,
): MarkdownImageClassification {
  const media = resolveMediaAccessOptions(access);
  const trimmed = src.trim();
  if (!trimmed) {
    return { kind: "blocked", reason: "invalid-src" };
  }

  if (isAllowedEmbeddedImageSource(trimmed)) {
    return { kind: "allowed-data", src: trimmed };
  }

  if (/^data:/i.test(trimmed)) {
    return { kind: "blocked", reason: "unsafe-data" };
  }

  let decodedSrc: string;
  try {
    decodedSrc = decodeURIComponent(trimmed);
  } catch {
    return { kind: "blocked", reason: "invalid-src" };
  }

  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(decodedSrc);
  if (schemeMatch) {
    const scheme = schemeMatch[1]?.toLowerCase() ?? "";
    if (scheme === "https") {
      if (media.loadRemoteImages) {
        return { kind: "allowed-remote", url: decodedSrc };
      }
      return {
        kind: "blocked",
        reason: "remote",
        reference: displayRemoteReference(decodedSrc),
        remoteUrl: decodedSrc,
      };
    }
    if (scheme === "http") {
      // http is never auto-fetched (clearer privacy / mixed-content boundary).
      return {
        kind: "blocked",
        reason: "remote",
        reference: displayRemoteReference(decodedSrc),
        remoteUrl: decodedSrc,
      };
    }
    return {
      kind: "blocked",
      reason: "unsupported-scheme",
      reference: scheme || undefined,
    };
  }

  if (
    !decodedSrc ||
    decodedSrc.includes("\\") ||
    decodedSrc.includes("?") ||
    decodedSrc.includes("#")
  ) {
    return {
      kind: "blocked",
      reason: "invalid-src",
      reference: displayLocalReference(decodedSrc),
    };
  }

  const srcIsAbsolute = isAbsolutePosix(decodedSrc);
  const documentDir =
    documentPath && isAbsolutePosix(documentPath)
      ? dirnamePosix(documentPath)
      : null;

  let resolved: string;
  if (srcIsAbsolute) {
    resolved = normalizePosix(decodedSrc);
  } else {
    const baseDir =
      documentDir ??
      (workspaceRoot ? normalizeWorkspaceRoot(workspaceRoot) : null);
    if (!baseDir) {
      return {
        kind: "blocked",
        reason: "missing-context",
        reference: displayLocalReference(decodedSrc),
      };
    }
    resolved = resolvePosix(baseDir, decodedSrc);
  }

  if (workspaceRoot) {
    const normalizedRoot = normalizeWorkspaceRoot(workspaceRoot);
    if (
      resolved === normalizedRoot ||
      resolved.startsWith(`${normalizedRoot}/`)
    ) {
      return { kind: "allowed-workspace", path: resolved };
    }
  }

  const outsidePolicy = media.outsideImages;
  const approved =
    outsidePolicy === "allow" ||
    isPathUnderApprovedRoots(resolved, media.approvedRoots);

  if (approved) {
    return { kind: "allowed-approved-local", path: resolved };
  }

  const canApproveLocal = outsidePolicy === "ask";

  // Relative escape: same Preview / HTML / PDF matrix as before.
  if (workspaceRoot && !srcIsAbsolute) {
    return {
      kind: "blocked",
      reason: "outside-workspace",
      reference: displayLocalReference(decodedSrc),
      resolvedPath: resolved,
      canApproveLocal,
    };
  }

  if (srcIsAbsolute) {
    return {
      kind: "blocked",
      reason: "absolute-outside",
      reference: displayLocalReference(decodedSrc),
      resolvedPath: resolved,
      canApproveLocal,
    };
  }

  return {
    kind: "blocked",
    reason: "missing-context",
    reference: displayLocalReference(decodedSrc),
  };
}

/**
 * One line of blocked-image copy: app text, with document-derived fragments
 * (alt text, reference) marked as such. The template decides where the fragment
 * sits, so `buildBlockedImageElement` never has to search the sentence and can
 * give those fragments their own `lang=""` node.
 */
export type BlockedImageNoteLine = ReadonlyArray<
  string | { readonly documentText: string }
>;

export type BlockedImageNoteCopy = {
  title: BlockedImageNoteLine;
  reasonLine: BlockedImageNoteLine;
  nextLine: string;
  approveLabel?: string;
};

/** Plain text of a note line (labels, tests, debugging). */
export function blockedImageNoteLineText(line: BlockedImageNoteLine): string {
  return line
    .map((part) => (typeof part === "string" ? part : part.documentText))
    .join("");
}

/**
 * Japanese-first blocked-image copy (Q-IMP-1 / existing Preview surface).
 * Stable `reason` keys live on `data-hazakura-image-block`.
 */
export function formatBlockedImageNote(options: {
  reason: ImageBlockReason;
  alt?: string | null;
  reference?: string | null;
  canApproveLocal?: boolean;
}): BlockedImageNoteCopy {
  const alt = options.alt?.trim() || "";
  const ref = options.reference?.trim() || "";
  const title: BlockedImageNoteLine = alt
    ? ["画像を表示できません: ", { documentText: alt }]
    : ["画像を表示できません"];
  /** `理由: …（ref）。` / 参照が無ければ `理由: …。` */
  const reasonInParens = (sentence: string, prefix = ""): BlockedImageNoteLine =>
    ref
      ? [`${sentence}（${prefix}`, { documentText: ref }, "）。"]
      : [`${sentence}。`];
  const approveLabel = options.canApproveLocal
    ? "この画像の親フォルダを許可して表示"
    : undefined;
  let copy: BlockedImageNoteCopy;

  switch (options.reason) {
    case "outside-workspace":
      copy = {
        title,
        reasonLine: reasonInParens("理由: ワークスペース外の相対パスです"),
        nextLine: options.canApproveLocal
          ? "次の操作: 下の許可を使うか、親フォルダをワークスペースとして開く。または workspace 内（例: assets/）へ画像を置く。"
          : "次の操作: 画像を含む親フォルダをワークスペースとして開く。または workspace 内（例: assets/）へ画像を置いて相対パスを直す。設定で「ワークスペース外の画像」を変更できます。",
        approveLabel,
      };
      break;
    case "absolute-outside":
      copy = {
        title,
        reasonLine: reasonInParens("理由: ワークスペース外の絶対パスです"),
        nextLine: options.canApproveLocal
          ? "次の操作: 下の許可を使うか、画像を workspace 内へ置いて相対パスで参照する。"
          : "次の操作: 画像を選択中の workspace 内へ置き、文書からの相対パスで参照する。",
        approveLabel,
      };
      break;
    case "remote":
      copy = {
        title,
        reasonLine: reasonInParens(
          "理由: リモート画像は設定で許可するまで読み込みません",
        ),
        nextLine:
          "次の操作: 設定 → 表示とメディア で「Preview でリモート画像を読み込む」をオン（https のみ・サーバーに要求が届きます）。またはローカルに保存して相対パスで参照する。",
      };
      break;
    case "unsupported-scheme":
      copy = {
        title,
        // Do not render a live `scheme:` token (e.g. `javascript:`).
        reasonLine: reasonInParens(
          "理由: この参照形式は使えません",
          "スキーム ",
        ),
        nextLine:
          "次の操作: workspace 内の相対パス、または対応する埋め込み画像を使う。",
      };
      break;
    case "unsafe-data":
      copy = {
        title,
        reasonLine: [
          "理由: 埋め込み画像の形式またはサイズが非対応です（png / jpeg / gif / webp の小さな data URL のみ）。",
        ],
        nextLine:
          "次の操作: 対応形式の小さな埋め込みにするか、workspace 内ファイルへの相対パスに切り替える。",
      };
      break;
    case "missing-context":
      copy = {
        title,
        reasonLine: reasonInParens(
          "理由: 画像パスを解決するワークスペース／文書コンテキストがありません",
        ),
        nextLine:
          "次の操作: フォルダをワークスペースとして開き、保存済みの Markdown からプレビューする。",
      };
      break;
    case "load-failed":
      copy = {
        title,
        reasonLine: reasonInParens("理由: 画像を読めませんでした"),
        nextLine:
          "次の操作: ファイルの有無・名前・拡張子・許可範囲を確認する。必要なら assets/ に置き直す。",
      };
      break;
    case "invalid-src":
    default:
      copy = {
        title,
        reasonLine: reasonInParens("理由: 画像参照を解釈できません"),
        nextLine:
          "次の操作: Markdown の画像構文とパスを確認する（バックスラッシュや不正な URL エンコードに注意）。",
      };
      break;
  }

  return copy;
}

/**
 * App-authored copy in these notes is Japanese today. The note declares that
 * language so it is not announced with the document's language, and the
 * document-derived fragments inside the copy (alt text, reference) become
 * their own `lang=""` nodes so they are not announced as Japanese either.
 * Translating these notes means changing this constant and the copy together.
 */
const BLOCKED_IMAGE_COPY_LANG = "ja";

/**
 * Append a note line, rendering the document-derived fragments as their own
 * language-unknown nodes. The template already decided where they sit, so this
 * never has to search the sentence.
 */
function appendNoteLine(host: HTMLElement, line: BlockedImageNoteLine): void {
  for (const part of line) {
    if (typeof part === "string") {
      host.append(part);
      continue;
    }
    const fromDocument = document.createElement("span");
    fromDocument.className = "blocked-image-document-text";
    fromDocument.setAttribute("lang", DOCUMENT_CONTENT_LANG);
    fromDocument.textContent = part.documentText;
    host.append(fromDocument);
  }
}

/** Build the Preview / export blocked-image note element. */
export function buildBlockedImageElement(options: {
  reason: ImageBlockReason;
  alt?: string | null;
  reference?: string | null;
  resolvedPath?: string | null;
  canApproveLocal?: boolean;
}): HTMLSpanElement {
  const copy = formatBlockedImageNote(options);
  const replacement = document.createElement("span");
  replacement.className = "blocked-image";
  replacement.setAttribute("lang", BLOCKED_IMAGE_COPY_LANG);
  replacement.setAttribute("role", "note");
  replacement.setAttribute("data-hazakura-image-block", options.reason);

  const alt = options.alt?.trim();
  if (alt) {
    replacement.setAttribute("data-hazakura-image-alt", alt);
  }
  const ref = options.reference?.trim();
  if (ref) {
    replacement.setAttribute("data-hazakura-image-ref", ref);
  }
  const resolved = options.resolvedPath?.trim();
  if (resolved) {
    replacement.setAttribute("data-hazakura-resolved-path", resolved);
  }

  const title = document.createElement("span");
  title.className = "blocked-image-title";
  appendNoteLine(title, copy.title);

  const reason = document.createElement("span");
  reason.className = "blocked-image-reason";
  appendNoteLine(reason, copy.reasonLine);

  const next = document.createElement("span");
  next.className = "blocked-image-next";
  next.textContent = copy.nextLine;

  replacement.append(title, reason, next);

  if (options.canApproveLocal && resolved && copy.approveLabel) {
    // Use a span (not <button>) so DOMPurify FORBID_TAGS does not strip it.
    const action = document.createElement("span");
    action.className = "blocked-image-action";
    action.setAttribute("role", "button");
    action.setAttribute("tabindex", "0");
    action.setAttribute("data-hazakura-image-action", "approve-parent");
    action.setAttribute("data-hazakura-resolved-path", resolved);
    action.textContent = copy.approveLabel;
    replacement.append(action);
  }

  return replacement;
}

/** Short label for EPUB / warning lists (alt preferred, then ref). */
export function blockedImageWarningLabel(element: HTMLElement): string | null {
  const alt = element.getAttribute("data-hazakura-image-alt")?.trim();
  if (alt) {
    return alt;
  }
  const ref = element.getAttribute("data-hazakura-image-ref")?.trim();
  if (ref) {
    return ref;
  }
  const text = element.textContent?.trim();
  if (!text) {
    return null;
  }
  return (
    text
      .replace(/^画像を表示できません:\s*/u, "")
      .replace(/^画像を表示できません/u, "")
      .replace(/^Image blocked:\s*/i, "")
      .split(/\n/)[0]
      ?.trim() || null
  );
}

function displayRemoteReference(url: string): string {
  try {
    const parsed = new URL(url);
    const hostPath = `${parsed.host}${parsed.pathname}`;
    return truncateDisplay(hostPath || parsed.href, 72);
  } catch {
    return truncateDisplay(url.replace(/^https?:\/\//i, ""), 72);
  }
}

function displayLocalReference(path: string): string | undefined {
  const trimmed = path.trim();
  if (!trimmed) {
    return undefined;
  }
  return truncateDisplay(trimmed, 96);
}

function truncateDisplay(value: string, max: number): string {
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function normalizeWorkspaceRoot(root: string): string {
  const withoutTrailingSlash = root.replace(/\/+$/, "");
  return withoutTrailingSlash || "/";
}

function isAbsolutePosix(path: string): boolean {
  return path.startsWith("/");
}

function dirnamePosix(path: string): string {
  const normalized = normalizePosix(path);
  if (normalized === "/") {
    return "/";
  }

  const index = normalized.lastIndexOf("/");
  if (index <= 0) {
    return "/";
  }
  return normalized.slice(0, index);
}

function resolvePosix(baseDir: string, relativePath: string): string {
  return normalizePosix(`${baseDir}/${relativePath}`);
}

function normalizePosix(path: string): string {
  const absolute = path.startsWith("/");
  const segments: string[] = [];

  for (const segment of path.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (segments.length > 0 && segments[segments.length - 1] !== "..") {
        segments.pop();
      } else if (!absolute) {
        segments.push(segment);
      }
      continue;
    }
    segments.push(segment);
  }

  const normalized = segments.join("/");
  return absolute ? `/${normalized}` : normalized;
}
