import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AmbientBackground } from "./AmbientBackground";

afterEach(cleanup);

function renderAmbient(
  mode: "yakou" | "shokou",
  intensity: "normal" | "dramatic" = "normal",
) {
  const { container } = render(
    <AmbientBackground intensity={intensity} mode={mode} />,
  );
  return Array.from(container.querySelectorAll<HTMLElement>(".ambient-particle"));
}

describe("AmbientBackground", () => {
  it("makes Yakou ambient particles dense enough to read", () => {
    expect(renderAmbient("yakou")).toHaveLength(52);
  });

  it("makes Shokou denser and keeps particles in a dawn shadow band", () => {
    const yakouParticles = renderAmbient("yakou");
    const particles = renderAmbient("shokou");
    const yakouSizes = yakouParticles
      .map((particle) =>
        Number.parseFloat(particle.style.getPropertyValue("--ambient-h")),
      )
      .filter((size) => Number.isFinite(size));
    const hues = particles
      .map((particle) =>
        Number.parseFloat(particle.style.getPropertyValue("--ambient-hue")),
      )
      .filter((hue) => Number.isFinite(hue));
    const sizes = particles
      .map((particle) =>
        Number.parseFloat(particle.style.getPropertyValue("--ambient-h")),
      )
      .filter((size) => Number.isFinite(size));
    const coolHues = hues.filter((hue) => hue >= 180);
    const warmHues = hues.filter((hue) => hue < 60);
    const embers = particles.filter((p) =>
      p.classList.contains("ambient-ember"),
    );

    expect(particles).toHaveLength(46);
    // 青灰帯が主で、夜明けの暖色を少数混ぜる
    expect(coolHues.length).toBeGreaterThan(warmHues.length);
    expect(Math.max(...coolHues)).toBeLessThanOrEqual(246);
    expect(Math.min(...warmHues)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...warmHues)).toBeLessThanOrEqual(40);
    // 暖色粒子は ember クラスで光の粉として描く
    expect(embers.length).toBe(warmHues.length);
    expect(embers.length).toBeGreaterThan(0);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(Math.max(...yakouSizes));
    expect(particles[0].style.getPropertyValue("--ambient-h")).toBe(
      yakouParticles[0].style.getPropertyValue("--ambient-h"),
    );
  });

  it("keeps Yakou particles in a purple–indigo–teal cosmic band", () => {
    const particles = renderAmbient("yakou");
    const hues = particles
      .map((particle) =>
        Number.parseFloat(particle.style.getPropertyValue("--ambient-hue")),
      )
      .filter((hue) => Number.isFinite(hue));

    expect(particles).toHaveLength(52);
    expect(Math.min(...hues)).toBeGreaterThanOrEqual(180);
    expect(Math.max(...hues)).toBeLessThanOrEqual(290);
  });

  it("keeps vivid Shokou particles close to the normal particle scale", () => {
    const normalParticles = renderAmbient("shokou");
    const vividParticles = renderAmbient("shokou", "dramatic");
    const normalSizes = normalParticles
      .map((particle) =>
        Number.parseFloat(particle.style.getPropertyValue("--ambient-h")),
      )
      .filter((size) => Number.isFinite(size));
    const vividSizes = vividParticles
      .map((particle) =>
        Number.parseFloat(particle.style.getPropertyValue("--ambient-h")),
      )
      .filter((size) => Number.isFinite(size));

    expect(vividParticles.length).toBeGreaterThan(normalParticles.length);
    expect(Math.max(...vividSizes)).toBeLessThanOrEqual(
      Math.max(...normalSizes) * 1.08,
    );
  });
});
