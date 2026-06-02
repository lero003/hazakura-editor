// Thin re-export of the per-area `lib/locale/*` modules. New
// code should import from the specific module (e.g.
// `lib/locale/editorChrome`); this top-level re-export is kept
// so the existing `from "../../lib/locale"` imports across the
// app resolve unchanged while the surface moves area by area.
export * from "./locale/index";
