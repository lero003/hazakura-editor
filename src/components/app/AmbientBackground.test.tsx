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

  it("makes Shokou denser and keeps particles in a cool shadow band", () => {
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

    expect(particles).toHaveLength(46);
    expect(Math.min(...hues)).toBeGreaterThanOrEqual(210);
    expect(Math.max(...hues)).toBeLessThanOrEqual(246);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(Math.max(...yakouSizes));
    expect(particles[0].style.getPropertyValue("--ambient-h")).toBe(
      yakouParticles[0].style.getPropertyValue("--ambient-h"),
    );
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
