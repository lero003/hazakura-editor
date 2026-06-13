import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AmbientBackground } from "./AmbientBackground";

afterEach(cleanup);

function renderAmbient(mode: "sakura" | "yakou" | "shokou") {
  const { container } = render(
    <AmbientBackground intensity="normal" mode={mode} />,
  );
  return Array.from(container.querySelectorAll<HTMLElement>(".ambient-particle"));
}

describe("AmbientBackground", () => {
  it("keeps Sakura calmer than the other special themes", () => {
    expect(renderAmbient("sakura")).toHaveLength(24);
  });

  it("renders Sakura particles as small round falling dots", () => {
    const particles = renderAmbient("sakura");
    const firstParticle = particles[0];

    expect(firstParticle.style.getPropertyValue("--ambient-w")).toBe(
      firstParticle.style.getPropertyValue("--ambient-h"),
    );
    expect(Number.parseFloat(firstParticle.style.getPropertyValue("--ambient-h")))
      .toBeLessThan(5);
  });

  it("makes Yakou ambient particles dense enough to read", () => {
    expect(renderAmbient("yakou")).toHaveLength(52);
  });

  it("makes Shokou denser and uses colored hue variation", () => {
    const particles = renderAmbient("shokou");
    const hues = particles
      .map((particle) =>
        Number.parseFloat(particle.style.getPropertyValue("--ambient-hue")),
      )
      .filter((hue) => Number.isFinite(hue));

    expect(particles).toHaveLength(46);
    expect(Math.min(...hues)).toBeLessThan(45);
    expect(Math.max(...hues)).toBeGreaterThan(190);
  });
});
