import { requestLocalAssistSurface } from "../appleAssist/sidebarBridge";
import { openAppleAssistWindow as openDetached, toggleAppleAssistWindow as toggleDetached } from "./agent";

/** Main-window entry points prefer its registered sidebar; detached callers keep the native route. */
export async function openAppleAssistWindow(theme?: string): Promise<void> {
  if (!requestLocalAssistSurface("open")) await openDetached(theme);
}
export async function toggleAppleAssistWindow(theme?: string): Promise<void> {
  if (!requestLocalAssistSurface("toggle")) await toggleDetached(theme);
}
