// Public surface of the L Mode module.
//
// Consumers (EditorPane.tsx, the L Mode chrome components,
// the test suite) import from this barrel. The internal split
// (classes.ts, lineDecorations.ts, contentDecorations.ts,
// widgets.ts, settings.ts, extension.ts) is an implementation
// detail that can be reorganized without touching callers.

export { LModeClasses, LModeChipLabels, LModeBlockRules, LModeExtraLineClasses, LModeInlineRules, LModeMarkerNodeNames } from "./classes";
export type { LModeClassName, LModeBlockRule, LModeInlineRule } from "./classes";
export { LModeHorizontalRuleWidget, LModeTableDelimiterWidget } from "./widgets";
export { lModeExtension } from "./extension";
export type { LModeContext } from "./extension";
export { LModeImageWidget, classifyImageUrl, peekResolvedImage, ensureWorkspaceImageResolved, refreshImagesEffect, lModeImageResolverPlugin } from "./imageWidget";
export { LModeTaskWidget, lModeTaskClickPlugin } from "./taskWidget";
export { parseLModeSettings, mergeLModeSettings, LMODE_SETTINGS_DEFAULTS } from "./settings";
export type { LModeSettings } from "./settings";
