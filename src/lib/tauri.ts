// Thin re-export of the per-area `lib/tauri/*` modules. New
// code should import from the specific module (e.g.
// `lib/tauri/files`); this top-level re-export is kept so the
// existing `from "../../lib/tauri"` imports across the app
// resolve unchanged while the surface moves area by area.
export * from "./tauri/index";
