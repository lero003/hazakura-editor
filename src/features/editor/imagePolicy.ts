// Shared Markdown image policy for surfaces that render image URLs directly
// into the WebView. Workspace image files are handled separately through the
// bounded Rust image commands.
//
// M0 (Theme G): classify *why* an image is blocked and show reason + next
// actions. Load policy is unchanged — no remote fetch, no outside-workspace
// disk open.

export const MAX_EMBEDDED_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB

/** Stable machine keys for blocked-image notes (tests + future actions). */
export type ImageBlockReason =
  | "outside-workspace"
  | "absolute-outside"
  | "remote"
  | "unsupported-scheme"
  | "unsafe-data"
  | "invalid-src"
  | "missing-context"
  | "load-failed";

export type MarkdownImageClassification =
  | { kind: "allowed-data"; src: string }
  | { kind: "allowed-workspace"; path: string }
  | {
      kind: "blocked";
      reason: ImageBlockReason;
      /** Short display-safe hint (relative src, host URL, scheme). */
      reference?: string;
    };

export function isAllowedEmbeddedImageSource(src: string): boolean {
  if (src.length > MAX_EMBEDDED_IMAGE_BYTES) {
    return false;
  }
  return /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(src);
}

/**
 * Pure classification for Preview / e-book / HTML / PDF image policy.
 * Does not read disk or network.
 */
export function classifyMarkdownImageSource(
  src: string,
  workspaceRoot: string | null,
  documentPath: string | null,
): MarkdownImageClassification {
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
    if (scheme === "http" || scheme === "https") {
      return {
        kind: "blocked",
        reason: "remote",
        reference: displayRemoteReference(decodedSrc),
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

  // Relative escape: same Preview / HTML / PDF matrix as before.
  if (workspaceRoot && !srcIsAbsolute) {
    return {
      kind: "blocked",
      reason: "outside-workspace",
      reference: displayLocalReference(decodedSrc),
    };
  }

  if (srcIsAbsolute) {
    return {
      kind: "blocked",
      reason: "absolute-outside",
      reference: displayLocalReference(decodedSrc),
    };
  }

  return {
    kind: "blocked",
    reason: "missing-context",
    reference: displayLocalReference(decodedSrc),
  };
}

export type BlockedImageNoteCopy = {
  title: string;
  reasonLine: string;
  nextLine: string;
};

/**
 * Japanese-first blocked-image copy (Q-IMP-1 / existing Preview surface).
 * Stable `reason` keys live on `data-hazakura-image-block`.
 */
export function formatBlockedImageNote(options: {
  reason: ImageBlockReason;
  alt?: string | null;
  reference?: string | null;
}): BlockedImageNoteCopy {
  const alt = options.alt?.trim() || "";
  const ref = options.reference?.trim() || "";
  const title = alt ? `画像を表示できません: ${alt}` : "画像を表示できません";

  switch (options.reason) {
    case "outside-workspace":
      return {
        title,
        reasonLine: ref
          ? `理由: ワークスペース外の相対パスです（${ref}）。`
          : "理由: ワークスペース外の相対パスです。",
        nextLine:
          "次の操作: 画像を含む親フォルダをワークスペースとして開く。または workspace 内（例: assets/）へ画像を置いて相対パスを直す。",
      };
    case "absolute-outside":
      return {
        title,
        reasonLine: ref
          ? `理由: ワークスペース外の絶対パスは開きません（${ref}）。`
          : "理由: ワークスペース外の絶対パスは開きません。",
        nextLine:
          "次の操作: 画像を選択中の workspace 内へ置き、文書からの相対パスで参照する。",
      };
    case "remote":
      return {
        title,
        reasonLine: ref
          ? `理由: リモート画像は既定で読み込みません（${ref}）。`
          : "理由: リモート画像は既定で読み込みません。",
        nextLine:
          "次の操作: 画像をローカルに保存し workspace 内の相対パスで参照する（設定での許可は今後）。",
      };
    case "unsupported-scheme":
      return {
        title,
        // Do not render a live `scheme:` token (e.g. `javascript:`) that
        // scanners treat as an active URI; show the scheme name only.
        reasonLine: ref
          ? `理由: この参照形式は使えません（スキーム ${ref}）。`
          : "理由: この参照形式は使えません。",
        nextLine:
          "次の操作: workspace 内の相対パス、または対応する埋め込み画像を使う。",
      };
    case "unsafe-data":
      return {
        title,
        reasonLine:
          "理由: 埋め込み画像の形式またはサイズが非対応です（png / jpeg / gif / webp の小さな data URL のみ）。",
        nextLine:
          "次の操作: 対応形式の小さな埋め込みにするか、workspace 内ファイルへの相対パスに切り替える。",
      };
    case "missing-context":
      return {
        title,
        reasonLine: ref
          ? `理由: 画像パスを解決するワークスペース／文書コンテキストがありません（${ref}）。`
          : "理由: 画像パスを解決するワークスペース／文書コンテキストがありません。",
        nextLine:
          "次の操作: フォルダをワークスペースとして開き、保存済みの Markdown からプレビューする。",
      };
    case "load-failed":
      return {
        title,
        reasonLine: ref
          ? `理由: ワークスペース内の画像を読めませんでした（${ref}）。`
          : "理由: ワークスペース内の画像を読めませんでした。",
        nextLine:
          "次の操作: ファイルの有無・名前・拡張子を確認する。必要なら assets/ に置き直す。",
      };
    case "invalid-src":
    default:
      return {
        title,
        reasonLine: ref
          ? `理由: 画像参照を解釈できません（${ref}）。`
          : "理由: 画像参照を解釈できません。",
        nextLine:
          "次の操作: Markdown の画像構文とパスを確認する（バックスラッシュや不正な URL エンコードに注意）。",
      };
  }
}

/** Build the Preview / export blocked-image note element. */
export function buildBlockedImageElement(options: {
  reason: ImageBlockReason;
  alt?: string | null;
  reference?: string | null;
}): HTMLSpanElement {
  const copy = formatBlockedImageNote(options);
  const replacement = document.createElement("span");
  replacement.className = "blocked-image";
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

  const title = document.createElement("span");
  title.className = "blocked-image-title";
  title.textContent = copy.title;

  const reason = document.createElement("span");
  reason.className = "blocked-image-reason";
  reason.textContent = copy.reasonLine;

  const next = document.createElement("span");
  next.className = "blocked-image-next";
  next.textContent = copy.nextLine;

  replacement.append(title, reason, next);
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
  // Avoid echoing multi-kilobyte garbage; keep what the author typed.
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
