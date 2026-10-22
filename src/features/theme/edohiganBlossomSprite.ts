/**
 * 江戸彼岸の花のスプライト / Procedural five-petal blossom sprite.
 *
 * 花弁 1 枚の webp を 3 方向へ回して重ねるのをやめ、5 弁の花を canvas に描いて
 * テクスチャにする。外部 fetch も `blob:` も使わない（CSP 変更なし）。
 * 128px 四方なので、樹冠に 2,000 枚置いてもテクスチャは 1 枚で済む。
 *
 * 花びらの縁は淡紅と透けを残し、花の外側は透明にする。
 * 遠目にも輪郭がぼやけすぎず、板ポリの四角い輪郭は出ない。
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
  edgeColor: "rgba(250, 212, 223, 0.76)",
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

    // 薄い花弁にも面を残す。透過を広く抜くと、遠景で花形が霞に溶けてしまう。
    const gradient = context.createRadialGradient(
      0,
      -petalLength * 0.42,
      size * 0.02,
      0,
      -petalLength * 0.42,
      petalLength * 0.6,
    );
    gradient.addColorStop(0, options.centerColor ?? BLOSSOM_SPRITE_DEFAULTS.centerColor);
    gradient.addColorStop(0.45, "rgba(255, 246, 248, 0.96)");
    gradient.addColorStop(0.82, "rgba(253, 229, 235, 0.86)");
    gradient.addColorStop(1, options.edgeColor ?? BLOSSOM_SPRITE_DEFAULTS.edgeColor);

    context.fillStyle = gradient;
    context.beginPath();
    // 桜らしい浅い切れ込み。尖った涙形より、五弁の丸い肩が光を拾う。
    context.moveTo(0, 0);
    context.bezierCurveTo(
      petalWidth * 0.48,
      -petalLength * 0.22,
      petalWidth * 1.03,
      -petalLength * 0.52,
      petalWidth * 0.75,
      -petalLength * 0.82,
    );
    context.bezierCurveTo(
      petalWidth * 0.6,
      -petalLength * 1.01,
      petalWidth * 0.22,
      -petalLength * 1.035,
      0,
      -petalLength * 0.895,
    );
    context.bezierCurveTo(
      -petalWidth * 0.22,
      -petalLength * 1.035,
      -petalWidth * 0.6,
      -petalLength * 1.01,
      -petalWidth * 0.75,
      -petalLength * 0.82,
    );
    context.bezierCurveTo(
      -petalWidth * 1.03,
      -petalLength * 0.52,
      -petalWidth * 0.48,
      -petalLength * 0.22,
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

  // 小さな淡い蕊。遠景で黄色い点や太い輪に見えない量に留める。
  context.strokeStyle = "rgba(255, 243, 218, 0.65)";
  context.fillStyle = "rgba(255, 239, 208, 0.8)";
  context.lineWidth = size * 0.0045;
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * Math.PI * 2 + 0.2;
    const radius = size * (index % 2 === 0 ? 0.074 : 0.058);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    context.beginPath();
    context.moveTo(x * 0.28, y * 0.28);
    context.lineTo(x, y);
    context.stroke();
    context.beginPath();
    context.arc(x, y, size * 0.007, 0, Math.PI * 2);
    context.fill();
  }

  return canvas;
}
