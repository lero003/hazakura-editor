import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./_runtime";

export async function requestAppRestart(): Promise<void> {
  if (!isTauriRuntime()) {
    window.location.reload();
    return;
  }

  await invoke("request_app_restart");
}
