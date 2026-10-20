import { describe, expect, it } from "vitest";
import { readProjectFile } from "../../test-support/source";

describe("CRT scanline ownership", () => {
  it("leaves periodic scanlines to the device-pixel mask", () => {
    const source = readProjectFile("src/components/app/CrtShaderOverlay.tsx");
    // UV周期の細線と物理pxの前景細線を重ねるとモアレが生まれる。
    expect(source).not.toMatch(/const float SCAN_(?:LINES|DRIFT|AMP)\s*=/);
    expect(source).not.toMatch(/float scanLine\s*=/);
    // 背景の太い帯・砂嵐・色収差は維持する。
    expect(source).toContain("BAND_AMP * band");
    expect(source).toContain("SNOW_COEF * noiseAmp");
    expect(source).toContain("CA_COEF * u_intensity");
  });
});
