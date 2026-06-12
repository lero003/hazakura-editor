import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "./_runtime";

export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  await invoke("open_external_url", { url });
}
