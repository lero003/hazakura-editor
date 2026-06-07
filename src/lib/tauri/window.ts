import {
  getCurrentWindow,
  type CloseRequestedEvent,
  type Color,
  type Theme,
} from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./_runtime";

export async function closeCurrentWindow(): Promise<void> {
  await getCurrentWindow().close();
}

// v0.15 macOS close-flow fix (round 3 — hide the window, not
// the app).
//
// On macOS, the red button is the "close this window"
// affordance, not "quit the app" (`Cmd+Q` is the app-quit
// affordance, which Tauri fires `RunEvent::ExitRequested`
// for by default). Once the frontend intercepts
// `CloseRequested` with `preventDefault` (see
// `useWindowCloseConfirmation`), the NSApplication records
// the request as "rejected" and re-issuing
// `WebviewWindow::close()` / `WebviewWindow::destroy()`
// through the JS bridge is unreliable. The reliable path is
// the Rust `hide_main_window` command, which calls
// `WebviewWindow::hide()` → `NSWindow.orderOut:` directly,
// bypassing both the `windowShouldClose:` delegate and the
// `RunEvent::Exit` path. The .app stays alive on the Dock
// and the user re-opens the window by clicking the Dock
// icon.
//
// Use this from `useWindowCloseConfirmation` (clean + dirty
// paths) and `useTabCloseFlow` (after save / discard)
// instead of `closeCurrentWindow` / `destroyCurrentWindow`.
export async function hideMainWindow(): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }
  await invoke("hide_main_window");
}

export async function setCurrentWindowTitle(title: string): Promise<void> {
  if (!isTauriRuntime()) {
    document.title = title;
    return;
  }

  await getCurrentWindow().setTitle(title);
}

export async function setCurrentWindowTheme(theme: Theme): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await getCurrentWindow().setTheme(theme);
}

export async function setCurrentWindowBackgroundColor(
  color: Color,
): Promise<void> {
  if (!isTauriRuntime()) {
    return;
  }

  await getCurrentWindow().setBackgroundColor(color);
}

export async function onCurrentWindowCloseRequested(
  handler: (event: CloseRequestedEvent) => void | Promise<void>,
): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => {};
  }

  return getCurrentWindow().onCloseRequested(handler);
}
