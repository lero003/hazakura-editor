import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

export type GrayscalePngInfo = {
  width: number;
  height: number;
  /** 8bit グレースケール PNG の最小値（最も暗い画素）。 */
  minValue: number;
  maxValue: number;
};

/**
 * 8bit グレースケール PNG の値域を読む / Read the value range of an 8-bit gray PNG.
 *
 * 紙の目（`src/assets/themes/paper-grain.png`）は「紙をどれだけ暗くするか」で
 * コントラストに影響するため、テストは宣言値ではなく実アセットの最小値を使う。
 * 対応するのは 8bit・グレースケール・非インタレースのみ。別の形式で再生成された
 * 場合はここで明示的に落とし、コントラスト検査の前提が変わったことを知らせる。
 */
export function readGrayscalePngInfo(relativePath: string): GrayscalePngInfo {
  const buffer = readFileSync(`${process.cwd()}/${relativePath}`);
  if (buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`${relativePath}: not a PNG`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }

  if (bitDepth !== 8 || colorType !== 0 || interlace !== 0) {
    throw new Error(
      `${relativePath}: expected 8-bit grayscale non-interlaced PNG`,
    );
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width + 1; // filter byte + pixels
  let minValue = 255;
  let maxValue = 0;
  for (let y = 0; y < height; y++) {
    const rowStart = y * stride;
    if (raw[rowStart] !== 0) {
      throw new Error(
        `${relativePath}: unsupported PNG row filter ${raw[rowStart]} (expected 0)`,
      );
    }
    for (let x = 0; x < width; x++) {
      const value = raw[rowStart + 1 + x];
      if (value < minValue) minValue = value;
      if (value > maxValue) maxValue = value;
    }
  }

  return { width, height, minValue, maxValue };
}
