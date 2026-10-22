/**
 * 江戸彼岸の花のスプライト / Procedural five-petal blossom sprite.
 *
 * 花弁 1 枚の webp を 3 方向へ回して重ねるのをやめ、5 弁の花を canvas に描いて
 * テクスチャにする。外部 fetch も `blob:` も使わない（CSP 変更なし）。
 * 128px 四方なので、樹冠に 2,000 枚置いてもテクスチャは 1 枚で済む。
 *
 * 花びらの縁は円の外へ向かってアルファを抜く。板ポリの四角い輪郭が
 * 出ないので、遠目にも「花の塊」に見える。
 */

export type BlossomSpriteOptions = {
  size?: number;
  petals?: number;
  /** 花の中心の色。 */
  centerColor?: string;
  /** 花びらの縁の色。 */
  edgeColor?: string;
};

export const BLOSSOM_SPRITE_DEFAULTS = {
  size: 128,
  petals: 5,
  centerColor: "rgba(255, 255, 255, 1)",
  edgeColor: "rgba(247, 196, 210, 0)",
} as const;

/**
 * 花のスプライトを描いた canvas を返す。DOM が無い環境（テスト）では null。
 * 呼び出し側が `CanvasTexture` にする。
 */
export function drawBlossomSprite(options: BlossomSpriteOptions = {}): HTMLCanvasElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  const size = options.size ?? BLOSSOM_SPRITE_DEFAULTS.size;
  const petals = options.petals ?? BLOSSOM_SPRITE_DEFAULTS.petals;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  const center = size / 2;
  context.clearRect(0, 0, size, size);
  context.translate(center, center);

  const petalLength = size * 0.4;
  const petalWidth = size * 0.17;

  for (let index = 0; index < petals; index += 1) {
    context.save();
    context.rotate((index / petals) * Math.PI * 2);

    // 花びら 1 枚。根本は白く、縁へ向かって淡紅、外側はアルファ 0。
    const gradient = context.createRadialGradient(0, -petalLength * 0.2, size * 0.02, 0, -petalLength, petalLength);
    gradient.addColorStop(0, options.centerColor ?? BLOSSOM_SPRITE_DEFAULTS.centerColor);
    gradient.addColorStop(0.55, "rgba(255, 236, 242, 0.98)");
    gradient.addColorStop(0.86, "rgba(250, 214, 224, 0.55)");
    gradient.addColorStop(1, options.edgeColor ?? BLOSSOM_SPRITE_DEFAULTS.edgeColor);

    context.fillStyle = gradient;
    context.beginPath();
    // 先端をわずかに尖らせた涙形。
    context.moveTo(0, 0);
    context.bezierCurveTo(
      petalWidth,
      -petalLength * 0.35,
      petalWidth * 0.92,
      -petalLength * 0.85,
      0,
      -petalLength,
    );
    context.bezierCurveTo(
      -petalWidth * 0.92,
      -petalLength * 0.85,
      -petalWidth,
      -petalLength * 0.35,
      0,
      0,
    );
    context.closePath();
    context.fill();
    context.restore();
  }

  // 蕊。中心を少し紅くすると、白い塊ではなく花に見える。
  const core = context.createRadialGradient(0, 0, 0, 0, 0, size * 0.1);
  core.addColorStop(0, "rgba(214, 128, 150, 0.95)");
  core.addColorStop(0.6, "rgba(232, 168, 182, 0.55)");
  core.addColorStop(1, "rgba(240, 190, 200, 0)");
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, size * 0.1, 0, Math.PI * 2);
  context.fill();

  return canvas;
}
