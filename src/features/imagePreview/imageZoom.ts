/**
 * 画像プレビューの表示倍率（画面24）。
 *
 * **倍率の定義**: 100% = 「画像 1 px が CSS 1 px に対応する」。
 * devicePixelRatio では変えない（Retina では OS が物理画素へ拡大するが、
 * 倍率の意味は CSS px 基準で一定に保つ）。この定義を記録としてここに置く。
 *
 * **「全体を表示」（fit）は 100% と同じ意味にしない**。fit は現在の表示領域から
 * 計算する係数で、画像が表示領域より大きければ 100% 未満になり、小さければ
 * 1（=100%）で止める（小さい画像を不自然に拡大しない）。
 */

export const IMAGE_ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 1, 1.5, 2, 3, 4] as const;
export const IMAGE_ZOOM_MIN = IMAGE_ZOOM_STEPS[0];
export const IMAGE_ZOOM_MAX = IMAGE_ZOOM_STEPS[IMAGE_ZOOM_STEPS.length - 1];
/** fit のときに画像のまわりへ残す余白（表示領域の内側に収める）。 */
export const IMAGE_FIT_PADDING = 24;

export type ImageSize = { width: number; height: number };

/** 段階的な倍率。方向は -1（縮小）/ 1（拡大）。 */
export function nextImageZoom(current: number, direction: -1 | 1): number {
  if (direction > 0) {
    return IMAGE_ZOOM_STEPS.find((step) => step > current + 1e-6) ?? IMAGE_ZOOM_MAX;
  }
  const lower = [...IMAGE_ZOOM_STEPS].reverse().find((step) => step < current - 1e-6);
  return lower ?? IMAGE_ZOOM_MIN;
}

/**
 * 表示領域に合わせた倍率。100%（1）を上限にするので、小さい画像は拡大しない。
 * 表示領域が未計測（0）のときは 100% を返す。
 */
export function fitImageZoom(stage: ImageSize, natural: ImageSize, max = 1): number {
  if (stage.width <= 0 || stage.height <= 0 || natural.width <= 0 || natural.height <= 0) {
    return max;
  }
  const byWidth = (stage.width - IMAGE_FIT_PADDING) / natural.width;
  const byHeight = (stage.height - IMAGE_FIT_PADDING) / natural.height;
  return Math.max(0.05, Math.min(max, byWidth, byHeight));
}

export function formatImageZoom(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

const IMAGE_FORMAT_LABELS: Record<string, string> = {
  jpg: "JPEG",
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
  gif: "GIF",
  svg: "SVG",
  avif: "AVIF",
  bmp: "BMP",
  tif: "TIFF",
  tiff: "TIFF",
  heic: "HEIC",
};

/** 拡張子から形式名を出す。判断できないときは null（推測で埋めない）。 */
export function imageFormatLabel(name: string): string | null {
  const match = /\.([a-z0-9]+)$/i.exec(name.trim());
  if (!match) return null;
  const extension = match[1].toLowerCase();
  return IMAGE_FORMAT_LABELS[extension] ?? extension.toUpperCase();
}

/** ワークスペースからの相対パス。ルート外・不明なら null（勝手に削らない）。 */
export function relativeImagePath(path: string, root: string | null | undefined): string | null {
  if (!root) return null;
  const normalizedRoot = root.replace(/\/+$/, "");
  if (!normalizedRoot || !path.startsWith(`${normalizedRoot}/`)) return null;
  const relative = path.slice(normalizedRoot.length + 1);
  return relative.length > 0 ? relative : null;
}
