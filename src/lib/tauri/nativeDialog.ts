import { invoke } from "@tauri-apps/api/core";

// Fixed-purpose native commands are restricted to the main window in Rust.
// They use the same rfd backend for OS dialogs and user-selected access.
// Paths and extension filters pass through unchanged; normalization belongs to
// the existing callers. Preserve the upstream shallow freeze of open/save options.
type DialogFilter = { name: string; extensions: string[] };

export type OpenDialogOptions = {
  title?: string;
  filters?: DialogFilter[];
  defaultPath?: string;
  multiple?: boolean;
  directory?: boolean;
  recursive?: boolean;
  canCreateDirectories?: boolean;
};

export type SaveDialogOptions = {
  title?: string;
  filters?: DialogFilter[];
  defaultPath?: string;
  canCreateDirectories?: boolean;
};

export type ConfirmDialogOptions = {
  title?: string;
  kind?: "info" | "warning" | "error";
  okLabel?: string;
  cancelLabel?: string;
};

export async function open(
  options: OpenDialogOptions = {},
): Promise<string | string[] | null> {
  Object.freeze(options);
  return invoke<string | string[] | null>("open_native_dialog", { options });
}

export async function save(options: SaveDialogOptions = {}): Promise<string | null> {
  Object.freeze(options);
  return invoke<string | null>("save_native_dialog", { options });
}

export async function confirm(
  message: string,
  options?: ConfirmDialogOptions | string,
): Promise<boolean> {
  const settings = typeof options === "string" ? { title: options } : options;
  const acceptedLabel = settings?.okLabel ?? "Ok";
  const buttons = settings?.okLabel || settings?.cancelLabel
    ? { OkCancelCustom: [acceptedLabel, settings.cancelLabel ?? "Cancel"] }
    : "OkCancel";
  const selected = await invoke<string>("confirm_native_dialog", {
    message,
    title: settings?.title,
    kind: settings?.kind,
    buttons,
  });
  return selected === acceptedLabel;
}
