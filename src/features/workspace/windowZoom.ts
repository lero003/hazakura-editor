import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * 窓のドラッグ領域をダブルクリックしたときの挙動（実機指摘）。
 *
 * macOS のタイトルバーと同じ「ズーム」＝**最大化**であって、OS のフルスクリーン
 * （メニューバーが消える表示）にはしない。Tauri の独自ドラッグ領域は
 * `startDragging()` で自前実装しているため、OS 標準のダブルクリック判定は届かない。
 * native が無い（ブラウザ fixture）環境では黙って何もしない。
 */
export function toggleWindowZoom(): void {
  void getCurrentWindow()
    .toggleMaximize()
    .catch(() => {});
}
