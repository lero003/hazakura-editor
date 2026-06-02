import {
  getCurrentWindow,
  type CloseRequestedEvent,
  type Color,
  type Theme,
} from "@tauri-apps/api/window";
import { isTauriRuntime } from "./_runtime";

export async function closeCurrentWindow(): Promise<void> {
  await getCurrentWindow().close();
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
