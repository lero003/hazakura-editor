// L Mode (えるモード) settings delegation.
//
// The on-disk storage schema stays flat — the EditorSettings
// JSON blob continues to carry `lModeEnabled` and
// `lModeTypewriter` as top-level keys, so existing users keep
// their preferences through the refactor. The L Mode module
// owns the parsing/merging of those two fields, so adding a
// third L Mode toggle later (e.g. `lModeChipReveal`) becomes a
// one-file change here, not a hunt across the preferences hook.

import type { EditorSettings } from "../../../types";

/**
 * L Mode's user-facing settings. The field names match the
 * on-disk `EditorSettings` keys exactly so the helpers can be
 * spread / merged without renaming. The L Mode module is
 * allowed to read and write this shape; everything else in the
 * app talks to `EditorSettings` directly.
 */
export type LModeSettings = {
  lModeEnabled: boolean;
  lModeTypewriter: boolean;
};

export const LMODE_SETTINGS_DEFAULTS: LModeSettings = {
  lModeEnabled: false,
  lModeTypewriter: false,
};

/**
 * Extract L Mode's two settings from a partial parse of
 * the stored `EditorSettings` JSON. Unknown / missing values
 * fall back to `LMODE_SETTINGS_DEFAULTS`. The returned shape
 * is `LModeSettings` (matching the on-disk field names) so
 * the caller can spread it into a full `EditorSettings`.
 */
export function parseLModeSettings(
  parsed: Partial<EditorSettings>,
): LModeSettings {
  return {
    lModeEnabled:
      typeof parsed.lModeEnabled === "boolean"
        ? parsed.lModeEnabled
        : LMODE_SETTINGS_DEFAULTS.lModeEnabled,
    lModeTypewriter:
      typeof parsed.lModeTypewriter === "boolean"
        ? parsed.lModeTypewriter
        : LMODE_SETTINGS_DEFAULTS.lModeTypewriter,
  };
}

/**
 * Write L Mode's two settings back onto a full
 * `EditorSettings` record. Used by the preferences hook
 * when the user toggles a setting from the menu / command
 * palette. Other fields pass through unchanged.
 */
export function mergeLModeSettings(
  base: EditorSettings,
  next: LModeSettings,
): EditorSettings {
  return {
    ...base,
    lModeEnabled: next.lModeEnabled,
    lModeTypewriter: next.lModeTypewriter,
  };
}
