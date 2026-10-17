import { useMemo } from "react";
import type { MediaImageAccessOptions } from "../../../features/editor/imagePolicy";

/**
 * Identity of the media-access settings a rendered preview was produced with.
 * `EBookPane` and `PreviewPane` both fold the settings into one string so a
 * settings change re-renders the preview exactly once; keep the serialization
 * in one place so the two panes cannot drift apart.
 */
export function usePreviewMediaAccessKey(
  mediaAccess: MediaImageAccessOptions | null | undefined,
): string {
  return useMemo(
    () =>
      JSON.stringify({
        outsideImages: mediaAccess?.outsideImages ?? "ask",
        loadRemoteImages: mediaAccess?.loadRemoteImages ?? false,
        approvedRoots: mediaAccess?.approvedRoots ?? [],
      }),
    [mediaAccess],
  );
}

/**
 * Runs the action carried by a rendered `data-hazakura-image-action` element.
 * Only the "approve-parent" action exists today. Link interception stays with
 * each pane: the reader ignores clicks while a selection gesture is active,
 * the standard preview pane does not.
 */
export function applyPreviewMediaAction(
  actionHost: Element,
  onApproveLocalImageParent?: (path: string) => void,
): void {
  const action = actionHost.getAttribute("data-hazakura-image-action");
  const resolved =
    actionHost.getAttribute("data-hazakura-resolved-path")?.trim() ?? "";
  if (action === "approve-parent" && resolved && onApproveLocalImageParent) {
    onApproveLocalImageParent(resolved);
  }
}
