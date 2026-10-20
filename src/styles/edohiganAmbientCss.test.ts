import { describe, expect, it } from "vitest";
import { ruleBody, stripCssComments } from "../test-support/css";
import { readProjectFile } from "../test-support/source";

const css = stripCssComments(
  readProjectFile("src/styles/edohigan-theme.css"),
);

describe("edohigan petal motion", () => {
  it("drives every petal from one shared gust", () => {
    // 個々の花弁がそれぞれ独立したループを持つのをやめ、
    // 共通の風 1 つに乗せる。
    expect(ruleBody(css, ".edohigan-petals")).toContain(
      "animation: edohigan-gust 17s ease-in-out infinite alternate",
    );
    expect(css).toContain("@keyframes edohigan-gust");
  });

  it("gives each transform its own element", () => {
    // 同じ要素で transform を競合させないための 3 段構成。
    const petal = ruleBody(css, ".edohigan-petal");
    expect(petal).toContain("animation: edohigan-fall var(--petal-fall)");
    // 深度ブラーは中景・遠景だけ（近景に filter を当てない）。
    expect(ruleBody(css, '.edohigan-petal[data-depth="mid"],\n.edohigan-petal[data-depth="far"]')).toContain(
      "filter: blur(var(--petal-blur))",
    );
    expect(petal).not.toContain("filter:");
    expect(ruleBody(css, ".edohigan-petal i")).toContain(
      "animation: edohigan-sway var(--petal-sway)",
    );
    expect(ruleBody(css, ".edohigan-petal i::before")).toContain(
      "animation: edohigan-flip var(--petal-flip)",
    );
  });

  it("keeps rotation out of the fall and tied to the sway", () => {
    const fall = css.slice(
      css.indexOf("@keyframes edohigan-fall"),
      css.indexOf("@keyframes edohigan-sway"),
    );
    expect(fall).not.toContain("rotate(");
    // 横揺れと回転が同じ keyframes 内で同じ位相にあり、横速度と回転が対応する。
    const sway = css.slice(
      css.indexOf("@keyframes edohigan-sway"),
      css.indexOf("@keyframes edohigan-flip"),
    );
    expect(sway).toContain("translate3d(calc(var(--petal-sway-x) * -1)");
    expect(sway).toContain("rotate(calc(var(--petal-roll) * -1))");
    expect(sway).toContain("rotate(var(--petal-roll))");
  });

  it("approximates terminal velocity only where linear() is supported", () => {
    expect(css).toContain("@supports (animation-timing-function: linear(0, 1))");
    expect(ruleBody(css, ".edohigan-ambient")).toContain(
      "--petal-fall-ease: linear(",
    );
    // 未対応環境は `linear` のまま（ease で終端が減速するのを避ける）。
    expect(ruleBody(css, ".edohigan-petal")).toContain("linear infinite");
  });

  it("pauses every moving layer together", () => {
    const paused = css.slice(css.indexOf('[data-paused="true"]'));
    for (const layer of [
      ".edohigan-branch",
      ".edohigan-petals",
      ".edohigan-petal",
      ".edohigan-petal i",
      ".edohigan-petal i::before",
    ]) {
      expect(paused.slice(0, 400), layer).toContain(layer);
    }
    expect(paused).toContain("animation-play-state: paused");
  });

  it("removes the old two-value drift", () => {
    // 交互に 2 値だけの横流れと、落下と独立した回転ループの名残を消す。
    expect(css).not.toContain("--petal-drift");
    expect(css).not.toContain("--petal-turn");
    expect(css).not.toContain("@keyframes edohigan-turn");
  });

  it("casts the branch onto the paper", () => {
    expect(ruleBody(css, ".edohigan-branch")).toContain("filter: drop-shadow(");
  });
});
