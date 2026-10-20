/**
 * 深海の流速場 / Shinkai flow field.
 *
 * 低解像度の速度場を JS 側で持ち、`mousemove` でカーソル周辺に力を加え、
 * 毎フレーム「移流 → 減衰 → 拡散」で静止へ戻す。シェーダーはこれを
 * `baseFlow` に加算するため、チリも光柱も「手で払った方向へ流れて戻る」。
 *
 * ここは純関数だけを置く（描画・DOM・WebGL に触れない）。配列は
 * 0..1 にエンコードした vec2 で、0.5 が静止。RG8 テクスチャへそのまま渡せる。
 *
 * 重要: 旧実装は減衰・拡散・移流がすべて「1 フレームあたり」の定数だった。
 * そのため 60fps と 30fps で水の粘性が変わり、間引き設定によって
 * 手触りが変わっていた。ここでは連続時間の係数へ直し、dt を掛けて積分する。
 * 1/60 秒の基準フレームで旧実装と同じ値になるよう係数を選んでいる。
 */

export const FLOW_GRID_W = 48;
export const FLOW_GRID_H = 27;
export const FLOW_CELLS = FLOW_GRID_W * FLOW_GRID_H;

/** 旧実装の「1 フレーム (=1/60 秒) あたり」の値。互換のために基準として残す。 */
export const FLOW_REFERENCE_DT = 1 / 60;
export const FLOW_DAMPING_PER_FRAME = 0.0065;
export const FLOW_DIFFUSE_PER_FRAME = 0.12;
export const FLOW_ADVECT_PER_FRAME = 0.5;

/** 1 ステップで受け付ける最大 dt。タブ復帰などの巨大な差分で発散させない。 */
const MAX_STEP_DT = 1 / 20;

const DAMPING_RATE_PER_SECOND =
  -Math.log(1 - FLOW_DAMPING_PER_FRAME) / FLOW_REFERENCE_DT;
const DIFFUSION_RATE_PER_SECOND =
  -Math.log(1 - FLOW_DIFFUSE_PER_FRAME) / FLOW_REFERENCE_DT;
const ADVECTION_CELLS_PER_SECOND = FLOW_ADVECT_PER_FRAME / FLOW_REFERENCE_DT;

/** 初期状態は静止 (0.5, 0.5)。 */
export function createFlowField(): Float32Array {
  const field = new Float32Array(FLOW_CELLS * 2);
  field.fill(0.5);
  return field;
}

/** dt 秒ぶんの減衰率（残る割合）。 */
export function flowDecayFactor(dtSeconds: number): number {
  return Math.exp(-DAMPING_RATE_PER_SECOND * clampStep(dtSeconds));
}

/** dt 秒ぶんの拡散率（隣接平均へ寄る割合）。 */
export function flowDiffusionFactor(dtSeconds: number): number {
  const blended =
    1 - Math.exp(-DIFFUSION_RATE_PER_SECOND * clampStep(dtSeconds));
  // 拡散は 0..1 の混合率。1 を超えると発散するので上限を設ける。
  return Math.min(0.5, Math.max(0, blended));
}

function clampStep(dtSeconds: number): number {
  if (!Number.isFinite(dtSeconds) || dtSeconds <= 0) {
    return 0;
  }
  return Math.min(dtSeconds, MAX_STEP_DT);
}

/**
 * カーソル周辺へ力を加える / splat.
 * `x`, `y` はグリッド座標（セル単位・小数可）、`vx`, `vy` は 0..1 エンコード
 * 空間の差分。`radius` はセル単位、`boost` は力の増幅。
 */
export function splatFlowField(
  field: Float32Array,
  x: number,
  y: number,
  vx: number,
  vy: number,
  radius: number,
  boost: number,
): void {
  const x0 = Math.max(0, Math.floor(x - radius));
  const x1 = Math.min(FLOW_GRID_W - 1, Math.ceil(x + radius));
  const y0 = Math.max(0, Math.floor(y - radius));
  const y1 = Math.min(FLOW_GRID_H - 1, Math.ceil(y + radius));
  const sigma = radius * 0.5;
  for (let yy = y0; yy <= y1; yy += 1) {
    for (let xx = x0; xx <= x1; xx += 1) {
      const dx = xx + 0.5 - x;
      const dy = yy + 0.5 - y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > radius * radius) {
        continue;
      }
      const falloff = Math.exp(-distanceSquared / (2 * sigma * sigma));
      const index = (yy * FLOW_GRID_W + xx) * 2;
      field[index] = Math.min(
        1,
        Math.max(0, field[index] + vx * boost * falloff),
      );
      field[index + 1] = Math.min(
        1,
        Math.max(0, field[index + 1] + vy * boost * falloff),
      );
    }
  }
}

/**
 * 1 ステップ進める（移流 → 減衰 → 拡散）。`read` を読み、`write` へ書く。
 * ping-pong の入れ替えは呼び出し側が行う。
 */
export function stepFlowField(
  read: Float32Array,
  write: Float32Array,
  dtSeconds: number,
): void {
  const dt = clampStep(dtSeconds);
  if (dt === 0) {
    write.set(read);
    return;
  }
  const decay = flowDecayFactor(dt);
  const diffusion = flowDiffusionFactor(dt);
  const advectCells = ADVECTION_CELLS_PER_SECOND * dt;

  for (let yy = 0; yy < FLOW_GRID_H; yy += 1) {
    for (let xx = 0; xx < FLOW_GRID_W; xx += 1) {
      const index = (yy * FLOW_GRID_W + xx) * 2;
      const currentVx = read[index] * 2 - 1;
      const currentVy = read[index + 1] * 2 - 1;

      // 移流（自己輸送）: 半ステップ前の位置から流れてきた速度を双線形で受け継ぐ。
      const sourceX = xx - currentVx * advectCells;
      const sourceY = yy - currentVy * advectCells;
      const sx = Math.max(0, Math.min(FLOW_GRID_W - 1.001, sourceX));
      const sy = Math.max(0, Math.min(FLOW_GRID_H - 1.001, sourceY));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      const x1 = Math.min(FLOW_GRID_W - 1, x0 + 1);
      const y1 = Math.min(FLOW_GRID_H - 1, y0 + 1);
      const i00 = (y0 * FLOW_GRID_W + x0) * 2;
      const i10 = (y0 * FLOW_GRID_W + x1) * 2;
      const i01 = (y1 * FLOW_GRID_W + x0) * 2;
      const i11 = (y1 * FLOW_GRID_W + x1) * 2;
      const topX =
        (read[i00] * 2 - 1) + ((read[i10] * 2 - 1) - (read[i00] * 2 - 1)) * fx;
      const topY =
        (read[i00 + 1] * 2 - 1) +
        ((read[i10 + 1] * 2 - 1) - (read[i00 + 1] * 2 - 1)) * fx;
      const bottomX =
        (read[i01] * 2 - 1) + ((read[i11] * 2 - 1) - (read[i01] * 2 - 1)) * fx;
      const bottomY =
        (read[i01 + 1] * 2 - 1) +
        ((read[i11 + 1] * 2 - 1) - (read[i01 + 1] * 2 - 1)) * fx;
      let vx = topX + (bottomX - topX) * fy;
      let vy = topY + (bottomY - topY) * fy;

      vx *= decay;
      vy *= decay;

      // 拡散: 4 隣接との平均へ寄せる（簡易ラプラシアン）。境界外は数えない。
      let sumX = 0;
      let sumY = 0;
      let count = 0;
      if (xx > 0) {
        const n = (yy * FLOW_GRID_W + (xx - 1)) * 2;
        sumX += read[n] * 2 - 1;
        sumY += read[n + 1] * 2 - 1;
        count += 1;
      }
      if (xx < FLOW_GRID_W - 1) {
        const n = (yy * FLOW_GRID_W + (xx + 1)) * 2;
        sumX += read[n] * 2 - 1;
        sumY += read[n + 1] * 2 - 1;
        count += 1;
      }
      if (yy > 0) {
        const n = ((yy - 1) * FLOW_GRID_W + xx) * 2;
        sumX += read[n] * 2 - 1;
        sumY += read[n + 1] * 2 - 1;
        count += 1;
      }
      if (yy < FLOW_GRID_H - 1) {
        const n = ((yy + 1) * FLOW_GRID_W + xx) * 2;
        sumX += read[n] * 2 - 1;
        sumY += read[n + 1] * 2 - 1;
        count += 1;
      }
      if (count > 0) {
        vx += (sumX / count - vx) * diffusion;
        vy += (sumY / count - vy) * diffusion;
      }

      write[index] = vx * 0.5 + 0.5;
      write[index + 1] = vy * 0.5 + 0.5;
    }
  }
}

/** テストと観測用: 静止からのずれの総量。 */
export function flowEnergy(field: Float32Array): number {
  let total = 0;
  for (let index = 0; index < field.length; index += 1) {
    total += Math.abs(field[index] - 0.5);
  }
  return total;
}
