// v0.17 app-store-quality queue 4: support-diagnostics
// — privacy-preserving diagnostics collector.
//
// This module collects a bounded set of non-sensitive
// information the user can review before sharing for
// troubleshooting. It is intentionally NOT telemetry —
// there is no automatic upload, no background collection,
// and no network call. Every collected field goes through
// a readable redaction review so document contents,
// workspace paths, and secret-looking values never appear
// in the snapshot.

import { readHazakuraDistributionLane } from "./distributionLane";

// -----------------------------------------------------------------------
//  Diagnostics snapshot
// -----------------------------------------------------------------------

export interface DiagnosticsSnapshot {
  /** App identity (no user-created content). */
  app: {
    version: string;
    distributionLane: string;
  };

  /** OS / hardware (public from navigator). No architecture
   * (arm64/x86_64) is available without the Tauri `os`
   * plugin, so the field is intentionally omitted rather
   * than guessed. */
  system: {
    platform: string;
  };

  /** Feature flags currently visible to the user. */
  features: {
    appleLocalAssistAvailable: boolean;
    autoBackupEnabled: boolean;
    lModeEnabled: boolean;
    wrapLines: boolean;
    theme: string;
  };

  /** Sanitised recent-error summary — categories, counts,
   * never the full error messages that might contain
   * document paths or user content. */
  errors: {
    /** The last N error category tags, oldest first. */
    recentCategories: string[];
  };

  /** Unix-ms timestamp of when the snapshot was built. */
  collectedAtMs: number;
}

// -----------------------------------------------------------------------
//  Collector
// -----------------------------------------------------------------------

export interface CollectDiagnosticsOptions {
  /** Latest probe result from `useAppleAssistAvailability`. */
  appleLocalAssistAvailable: boolean;
  /** Whether auto-backup is currently enabled in editor settings. */
  autoBackupEnabled: boolean;
  /** Whether L Mode (えるモード) is enabled. */
  lModeEnabled: boolean;
  /** Whether line-wrapping is enabled. */
  wrapLines: boolean;
  /** Active theme preference. */
  theme: string;
  /** Recent error category tags (e.g. "Save conflict"). */
  recentErrorCategories: string[];
}

/**
 * Build a privacy-preserving diagnostics snapshot from the
 * given inputs. The returned object is pure data — it never
 * mutates global state or triggers a network call.
 *
 * Callers are responsible for showing the snapshot to the
 * user before it is shared (copy to clipboard / exported).
 * This function is the single point where data enters the
 * snapshot so a future refactor can add redaction rules
 * here without touching every call site.
 */
export function collectDiagnostics(
  options: CollectDiagnosticsOptions,
): DiagnosticsSnapshot {
  // Platform / architecture from the browser's navigator
  // object.  `navigator.platform` is stable (e.g.
  // "MacIntel").  Architecture (arm64 / x86_64) is not
  // available without the Tauri `os` plugin, so we
  // intentionally leave it out rather than guessing from
  // APIs that return platform strings.
  const platform =
    typeof navigator !== "undefined" ? navigator.platform ?? "" : "";

  // Sanitise error categories: keep only short, low-
  // cardinality tags that cannot carry document paths or
  // secret-looking values.  Unknown / long / path-like
  // strings are folded to a generic "Other" tag so the set
  // of categories stays bounded and privacy-safe.
  const sanitisedCategories = options.recentErrorCategories
    .map(sanitiseErrorCategory)
    .slice(-5);

  return {
    app: {
      version: "0.18.0",
      distributionLane: readHazakuraDistributionLane(),
    },
    system: {
      platform,
    },
    features: {
      appleLocalAssistAvailable: options.appleLocalAssistAvailable,
      autoBackupEnabled: options.autoBackupEnabled,
      lModeEnabled: options.lModeEnabled,
      wrapLines: options.wrapLines,
      theme: options.theme,
    },
    errors: {
      // Keep only the last 5 categories so the list stays
      // bounded regardless of how many errors the user hit
      // in a session.  Categories are sanitised by
      // `sanitiseErrorCategory` above — paths and secret-
      // looking strings never reach the snapshot.
      recentCategories: sanitisedCategories,
    },
    collectedAtMs: Date.now(),
  };
}

// -----------------------------------------------------------------------
//  Error category sanitisation
// -----------------------------------------------------------------------

/** Known-good error category tags.  Any input that does not
 *  match one of these is folded to "Other" so a future refactor
 *  that accidentally concatenates a document path or a stack
 *  trace into the category string does not leak it into the
 *  diagnostics snapshot. */
const SAFE_ERROR_CATEGORIES: ReadonlySet<string> = new Set([
  "Save conflict",
  "Save failed",
  "Save stopped",
  "Close failed",
  "Close stopped",
  "Metadata check failed",
  "External change detected",
  "External change refreshed",
  "Reopen failed",
  "Export HTML failed",
  "Print unavailable",
  "Cannot read file",
  "Cannot create file",
]);

/** Maximum length a single error category tag may have.
 *  Anything longer is folded to "Other". */
const MAX_ERROR_CATEGORY_LENGTH = 64;

function sanitiseErrorCategory(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ERROR_CATEGORY_LENGTH) {
    return "Other";
  }
  if (SAFE_ERROR_CATEGORIES.has(trimmed)) {
    return trimmed;
  }
  // The string is not in the known-safe set.  Before
  // falling back to "Other", do a quick structural check:
  // a raw category that looks like a path or contains
  // secret-like substrings must never leak.
  if (
    /[/\\]/.test(trimmed) ||
    /token/i.test(trimmed) ||
    /secret/i.test(trimmed) ||
    /password/i.test(trimmed) ||
    /key=/i.test(trimmed)
  ) {
    return "Other";
  }
  return "Other";
}

// -----------------------------------------------------------------------
//  Sanity helpers (used by tests to verify omissions)
// -----------------------------------------------------------------------

/** Well-known keys that must never appear in any snapshot. */
export const DIAGNOSTICS_FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  "documentContents",
  "contents",
  "fileContents",
  "workspacePath",
  "workspaceRoot",
  "workspacePaths",
  "providerTranscript",
  "transcript",
  "apiKey",
  "token",
  "secret",
  "password",
  "credential",
]);

/**
 * Walk a diagnostics snapshot (or its serialised JSON form)
 * and assert the snapshot does not contain any forbidden
 * key.  This is a structural check — it catches a future
 * field addition that accidentally bleeds document content
 * or workspace paths.
 */
export function assertNoForbiddenKeys(
  snapshot: DiagnosticsSnapshot | Record<string, unknown>,
): void {
  const keys = Object.keys(
    typeof snapshot === "object" && snapshot !== null ? snapshot : ({} as never),
  );

  const forbiddenKeys = new Set(DIAGNOSTICS_FORBIDDEN_KEYS);

  // Check forbidden keys first so the error message
  // names the offending key, not the generic path-match.
  for (const key of keys) {
    // Recurse into nested objects AND arrays so a future
    // refactor that adds `errors: [{ workspaceRoot: ... }]`
    // or similar array-of-object structures is caught.
    const value = (snapshot as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "object" && item !== null) {
          assertNoForbiddenKeys(item as Record<string, unknown>);
        }
      }
    } else if (typeof value === "object" && value !== null) {
      assertNoForbiddenKeys(value as Record<string, unknown>);
    }

    if (forbiddenKeys.has(key)) {
      throw new Error(
        `Snapshot contains forbidden key "${key}". ` +
          `Remove it before shipping.`,
      );
    }
  }

  // Walk the serialised form for absolute-path-looking
  // strings. This catches path strings stored under
  // an innocent-looking key.
  const json = JSON.stringify(snapshot);
  const absPathMatches = json.match(/"[A-Za-z]:[/\\][^"]+|"\/[^"]+"/g);
  if (absPathMatches) {
    for (const match of absPathMatches) {
      const cleaned = match.replace(/^"|"$/g, "");
      // Domain knowledge allow-list: these fields are
      // enum values, not real paths.
      if (
        cleaned === (typeof navigator !== "undefined" ? navigator.platform ?? "" : "") ||
        cleaned === "developer" ||
        cleaned === "app-store"
      ) {
        continue;
      }
      throw new Error(
        `Snapshot contains an absolute-path-looking string: ${match}`,
      );
    }
  }
}
