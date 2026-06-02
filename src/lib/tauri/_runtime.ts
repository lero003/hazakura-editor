// `isTauriRuntime` is the only "where am I running?" check the
// tauri helper layer uses; tauri-only paths (real `invoke`
// calls, window / dialog operations) early-out to a no-op when
// the page is loaded in a plain browser tab (the Vite dev
// server, the preview build, smoke tests outside the app
// shell). Keeping it in its own file so the rest of the
// `lib/tauri/*` modules can `import { isTauriRuntime } from
// "./_runtime"` without dragging in the rest of the surface.
export function isTauriRuntime(): boolean {
  return Boolean(
    (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
  );
}
