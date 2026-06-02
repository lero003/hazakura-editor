// Barrel for the per-area `lib/locale/*` copy modules. New code
// should import directly from the area (e.g.
// `lib/locale/editorChrome`); this barrel exists so existing
// `from "../../lib/locale"` import sites keep working while the
// surface moves area by area.
export * from "./agentWorkbench";
export * from "./editorChrome";
export * from "./preferences";
export * from "./recovery";
export * from "./reviewDesk";
export * from "./safeEditor";
export * from "./sidePane";
export * from "./slashMenu";
