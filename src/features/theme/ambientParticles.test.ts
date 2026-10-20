import { describe, expect, it } from "vitest";
import {
  AMBIENT_PARTICLE_COUNT,
  ambientWind,
  createAmbientParticleSeeds,
  sampleAmbientParticle,
} from "./ambientParticles";

const WIDTH = 1440;
const HEIGHT = 850;

describe("ambient particle seeds", () => {
  it("keeps the shipped particle counts at normal intensity", () => {
    expect(AMBIENT_PARTICLE_COUNT.yakou).toBe(52);
    expect(AMBIENT_PARTICLE_COUNT.shokou).toBe(46);
    expect(createAmbientParticleSeeds("yakou", "normal")).toHaveLength(52);
    expect(createAmbientParticleSeeds("shokou", "normal")).toHaveLength(46);
  });

  it("scales with intensity but never without bound", () => {
    const subtle = createAmbientParticleSeeds("yakou", "subtle");
    const normal = createAmbientParticleSeeds("yakou", "normal");
    const dramatic = createAmbientParticleSeeds("yakou", "dramatic");
    expect(subtle.length).toBeLessThan(normal.length);
    expect(dramatic.length).toBeGreaterThan(normal.length);
    expect(createAmbientParticleSeeds("yakou", "off")).toHaveLength(0);
  });

  it("is deterministic for the same mode and intensity", () => {
    expect(createAmbientParticleSeeds("shokou", "dramatic")).toEqual(
      createAmbientParticleSeeds("shokou", "dramatic"),
    );
  });

  it("keeps Yakou in a purple-indigo-teal cosmic band", () => {
    const hues = createAmbientParticleSeeds("yakou", "normal").map((s) => s.hue);
    expect(Math.min(...hues)).toBeGreaterThanOrEqual(180);
    expect(Math.max(...hues)).toBeLessThanOrEqual(290);
  });

  it("keeps Shokou cool with a minority of warm embers", () => {
    const seeds = createAmbientParticleSeeds("shokou", "normal");
    const cool = seeds.filter((seed) => seed.hue >= 180);
    const warm = seeds.filter((seed) => seed.hue < 60);
    expect(cool.length).toBeGreaterThan(warm.length);
    expect(Math.max(...cool.map((s) => s.hue))).toBeLessThanOrEqual(246);
    expect(Math.min(...warm.map((s) => s.hue))).toBeGreaterThanOrEqual(20);
    expect(Math.max(...warm.map((s) => s.hue))).toBeLessThanOrEqual(40);
    // 暖色だけが加算合成（夜明けの光の粉）。
    expect(warm.every((seed) => seed.glow)).toBe(true);
    expect(cool.some((seed) => seed.glow)).toBe(false);
  });

  it("keeps Shokou specks smaller than Yakou stars", () => {
    const yakou = Math.max(
      ...createAmbientParticleSeeds("yakou", "normal").map((s) => s.radiusPx),
    );
    const shokou = Math.max(
      ...createAmbientParticleSeeds("shokou", "normal").map((s) => s.radiusPx),
    );
    expect(shokou).toBeLessThanOrEqual(yakou);
  });

  it("does not blow up speck size at dramatic intensity", () => {
    const normal = Math.max(
      ...createAmbientParticleSeeds("shokou", "normal").map((s) => s.radiusPx),
    );
    const dramatic = Math.max(
      ...createAmbientParticleSeeds("shokou", "dramatic").map((s) => s.radiusPx),
    );
    expect(dramatic).toBeLessThanOrEqual(normal * 1.35);
  });

  it("makes dramatic faster than normal instead of slower", () => {
    // 旧実装は dramatic で周期が 1.35 倍（＝遅く）なっていた。物理と逆。
    const normal = createAmbientParticleSeeds("yakou", "normal")[0];
    const dramatic = createAmbientParticleSeeds("yakou", "dramatic")[0];
    expect(dramatic.periodSeconds).toBeLessThan(normal.periodSeconds);
  });

  it("layers depth instead of clustering it", () => {
    const depths = createAmbientParticleSeeds("yakou", "dramatic").map(
      (seed) => seed.depth,
    );
    const near = depths.filter((depth) => depth > 0.66).length;
    const mid = depths.filter((depth) => depth > 0.33 && depth <= 0.66).length;
    const far = depths.filter((depth) => depth <= 0.33).length;
    // どの帯も空にならない（黄金比 stride の層化）。
    expect(Math.min(near, mid, far)).toBeGreaterThan(2);
  });
});

describe("ambient particle motion", () => {
  it("keeps the shared wind bounded", () => {
    for (let t = 0; t < 400; t += 0.37) {
      expect(Math.abs(ambientWind(t))).toBeLessThanOrEqual(1.001);
    }
  });

  it("moves the wind continuously", () => {
    let previous = ambientWind(0);
    for (let t = 0.05; t < 200; t += 0.05) {
      const current = ambientWind(t);
      expect(Math.abs(current - previous)).toBeLessThan(0.05);
      previous = current;
    }
  });

  it("keeps every particle inside the layer with a bounded alpha", () => {
    const seeds = createAmbientParticleSeeds("shokou", "normal");
    for (let t = 0; t < 120; t += 3.1) {
      for (const seed of seeds) {
        const frame = sampleAmbientParticle(seed, t, WIDTH, HEIGHT);
        expect(frame.y).toBeGreaterThanOrEqual(-25);
        expect(frame.y).toBeLessThanOrEqual(HEIGHT + 25);
        expect(frame.x).toBeGreaterThan(-WIDTH * 0.05);
        expect(frame.x).toBeLessThan(WIDTH * 1.05);
        expect(frame.alpha).toBeGreaterThanOrEqual(0);
        expect(frame.alpha).toBeLessThanOrEqual(1);
        expect(frame.radiusPx).toBeGreaterThan(0);
      }
    }
  });

  it("rises over one period", () => {
    const seed = createAmbientParticleSeeds("yakou", "normal")[0];
    const start = sampleAmbientParticle(seed, 0, WIDTH, HEIGHT);
    const later = sampleAmbientParticle(
      seed,
      seed.periodSeconds * 0.5,
      WIDTH,
      HEIGHT,
    );
    expect(later.y).toBeLessThan(start.y);
  });

  it("twinkles instead of holding a constant alpha", () => {
    const seed = createAmbientParticleSeeds("yakou", "normal")[0];
    const samples = Array.from({ length: 40 }, (_, index) =>
      sampleAmbientParticle(seed, index * 0.25, WIDTH, HEIGHT).alpha,
    );
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(0.02);
  });

  it("applies pointer parallax more strongly to nearer particles", () => {
    const seeds = createAmbientParticleSeeds("yakou", "normal");
    const near = seeds.reduce((a, b) => (a.depth > b.depth ? a : b));
    const far = seeds.reduce((a, b) => (a.depth < b.depth ? a : b));
    const nearShift =
      sampleAmbientParticle(near, 4, WIDTH, HEIGHT, 20).x -
      sampleAmbientParticle(near, 4, WIDTH, HEIGHT, 0).x;
    const farShift =
      sampleAmbientParticle(far, 4, WIDTH, HEIGHT, 20).x -
      sampleAmbientParticle(far, 4, WIDTH, HEIGHT, 0).x;
    expect(nearShift).toBeGreaterThan(farShift);
  });
});
